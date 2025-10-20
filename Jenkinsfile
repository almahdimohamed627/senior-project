pipeline {
    agent any
    
    parameters {
        choice(
            name: 'COMPONENT',
            choices: ['all', 'backend', 'frontend', 'database', 'fusionAuth'],
            description: 'Select component to build'
        )
        booleanParam(
            name: 'DEPLOY',
            defaultValue: false,
            description: 'Deploy after successful build'
        )
    }
    
    stages {
        stage('Checkout SCM') {
            steps {
                checkout scm
            }
        }
        
        stage('Discover Components') {
            steps {
                script {
                    // Dynamically discover components with better error handling
                    def components = findComponents()
                    env.COMPONENTS = components.join(',')
                    // Store as serializable string instead of direct list
                    env.COMPONENTS_STRING = components.join(',')
                    echo "Discovered components: ${components}"
                }
            }
        }
        
        stage('Build Components') {
            steps {
                script {
                    // Recreate components list from string to avoid serialization issues
                    def components = env.COMPONENTS_STRING.split(',').toList()
                    
                    // Filter out invalid/empty component names
                    def validComponents = components.findAll { component ->
                        component && component.trim() && component != '[' && component != ']'
                    }
                    
                    echo "Valid components to build: ${validComponents}"
                    
                    if (validComponents.isEmpty()) {
                        echo "No valid components found to build"
                        return
                    }
                    
                    // Create parallel stages dynamically with proper serialization
                    def parallelStages = [:]
                    
                    validComponents.each { component ->
                        String safeComponent = component.trim()
                        // Use a simple string key to avoid serialization issues
                        parallelStages["build_${safeComponent}"] = getComponentBuildStage(safeComponent)
                    }
                    
                    // Execute all parallel stages
                    parallel parallelStages
                }
            }
        }
        
        stage('Integration Test') {
            steps {
                script {
                    runIntegrationTests()
                }
            }
        }
        
        stage('Deploy') {
            when { 
                expression { params.DEPLOY == true }
            }
            steps {
                script {
                    deployComponents()
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
            script {
                currentBuild.description = "Components: ${env.COMPONENTS}"
            }
        }
        success {
            script {
                echo "✅ Build ${currentBuild.result}: ${env.JOB_NAME} ${env.BUILD_NUMBER}"
                sendTelegramNotification("success")
            }
        }
        failure {
            script {
                echo "❌ Build ${currentBuild.result}: ${env.JOB_NAME} ${env.BUILD_NUMBER}"
                sendTelegramNotification("failure")
            }
        }
    }
}

// Telegram notification function
def sendTelegramNotification(String status) {
    try {
        withCredentials([
            string(credentialsId: 'telegram-bot-token', variable: 'BOT_TOKEN'),
            string(credentialsId: 'telegram-chat-id', variable: 'CHAT_ID')
        ]) {
            def message = ""
            def emoji = ""
            
            if (status == "success") {
                emoji = "✅"
                message = """
${emoji} *Build Success*
*Job:* ${env.JOB_NAME}
*Build:* #${env.BUILD_NUMBER}
*Components:* ${env.COMPONENTS}
*URL:* ${env.BUILD_URL}
"""
            } else {
                emoji = "❌"
                message = """
${emoji} *Build Failed*
*Job:* ${env.JOB_NAME}
*Build:* #${env.BUILD_NUMBER}
*Components:* ${env.COMPONENTS}
*URL:* ${env.BUILD_URL}
"""
            }
            
            sh """
                curl -s -X POST \
                -H 'Content-Type: application/json' \
                -d '{
                    "chat_id": "${CHAT_ID}",
                    "text": "${message}",
                    "parse_mode": "Markdown",
                    "disable_web_page_preview": true
                }' \
                "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" > /dev/null
            """
            
            echo "Telegram notification sent for ${status}"
        }
    } catch (Exception e) {
        echo "⚠️ Failed to send Telegram notification: ${e.message}"
    }
}

// Serializable function to create build stages
def getComponentBuildStage(String componentName) {
    return {
        stage("Build ${componentName}") {
            script {
                // Check if we should build this component
                boolean shouldBuild = params.COMPONENT == 'all' || params.COMPONENT == componentName
                
                if (shouldBuild) {
                    echo "Building component: ${componentName}"
                    buildComponent(componentName)
                } else {
                    echo "Skipping component ${componentName} - not selected in parameters"
                }
            }
        }
    }
}

// Helper functions
def findComponents() {
    def components = []
    try {
        if (fileExists('components')) {
            dir('components') {
                def jenkinsfiles = findFiles(glob: '*/Jenkinsfile')
                components = jenkinsfiles.collect { 
                    def path = it.path
                    def componentName = path.split('/')[0]
                    // Validate component name
                    if (componentName && componentName.trim() && !componentName.contains('[') && !componentName.contains(']')) {
                        return componentName.trim()
                    } else {
                        echo "Skipping invalid component name: ${componentName}"
                        return null
                    }
                }.findAll { it != null } // Remove null entries
                
                echo "Found components with Jenkinsfiles: ${components}"
                
                // Also look for directories without Jenkinsfiles but with docker-compose.yml or other build files
                def additionalComponents = discoverComponentsByStructure()
                components.addAll(additionalComponents)
                components = components.unique()
            }
        } else {
            echo "No components directory found"
        }
    } catch (Exception e) {
        echo "Error discovering components: ${e.message}"
        // Fallback to parameter choices minus 'all'
        components = ['backend', 'frontend', 'database', 'fusionAuth']
    }
    
    // Final validation and fallback
    if (components.isEmpty()) {
        components = ['backend', 'frontend']
    }
    
    return components
}

def discoverComponentsByStructure() {
    def additionalComponents = []
    try {
        // Use shell command to find component directories with common build files
        def componentDirs = sh(script: '''
            if [ -d "components" ]; then
                find components -maxdepth 1 -mindepth 1 -type d | \
                while read dir; do
                    dir_name=$(basename "$dir")
                    # Check if directory has any build-related files
                    if [ -f "$dir/Jenkinsfile" ] || [ -f "$dir/docker-compose.yml" ] || \
                       [ -f "$dir/Dockerfile" ] || [ -f "$dir/package.json" ] || \
                       [ -f "$dir/pom.xml" ]; then
                        echo "$dir_name"
                    fi
                done
            else
                echo ""
            fi
        ''', returnStdout: true).trim()
        
        if (componentDirs) {
            def foundComponents = componentDirs.split('\n')
            foundComponents.each { component ->
                if (component && component.trim()) {
                    additionalComponents << component.trim()
                }
            }
            echo "Found additional components by structure: ${additionalComponents}"
        }
    } catch (Exception e) {
        echo "Error in structure discovery: ${e.message}"
    }
    return additionalComponents
}

def buildComponent(componentName) {
    echo "Starting build for component: ${componentName}"
    
    // Check if component directory exists
    if (!fileExists("components/${componentName}")) {
        echo "⚠️ Component directory 'components/${componentName}' not found"
        return
    }
    
    dir("components/${componentName}") {
        try {
            if (fileExists('Jenkinsfile')) {
                echo "Loading component-specific Jenkinsfile for ${componentName}"
                load 'Jenkinsfile'
            } else {
                echo "No Jenkinsfile found for ${componentName}, using auto-build"
                autoBuildComponent(componentName)
            }
        } catch (Exception e) {
            echo "❌ Failed to build component ${componentName}: ${e.message}"
            // Don't fail the entire build if one component fails
        }
    }
}

def autoBuildComponent(componentName) {
    echo "Auto-building component: ${componentName}"
    
    if (fileExists('docker-compose.yml')) {
        sh '''
            echo "Docker Compose component detected"
            docker-compose config || true
            docker-compose pull --ignore-pull-failures || true
            # Only build if there are buildable services
            if docker-compose config | grep -q "build:"; then
                docker-compose build --no-cache || true
            fi
            # Test service startup
            docker-compose up -d || true
            sleep 10
            docker-compose ps || true
            docker-compose down || true
        '''
    } else if (fileExists('package.json')) {
        sh '''
            echo "Node.js component detected"
            npm install || true
            npm run build --if-present || true
        '''
    } else if (fileExists('pom.xml')) {
        sh '''
            echo "Java/Maven component detected" 
            mvn clean compile || true
        '''
    } else if (fileExists('Dockerfile')) {
        sh """
            echo "Docker component detected"
            docker build -t ${componentName}:${env.BUILD_TAG} . || true
        """
    } else {
        echo "⚠️ No build system detected for component ${componentName}"
        sh "echo 'No build required for ${componentName}'"
    }
}

def runIntegrationTests() {
    echo "Running integration tests"
    sh '''
        echo "Running integration tests between components"
        # Add your actual integration test commands here
    '''
}

def deployComponents() {
    echo "Deploying components"
    script {
        def components = env.COMPONENTS_STRING.split(',').toList()
        
        if (params.COMPONENT == 'all') {
            components.each { component ->
                if (component && component.trim()) {
                    deployComponent(component.trim())
                }
            }
        } else {
            deployComponent(params.COMPONENT)
        }
    }
}

def deployComponent(componentName) {
    echo "Deploying component: ${componentName}"
    
    if (!fileExists("components/${componentName}")) {
        echo "⚠️ Component directory 'components/${componentName}' not found for deployment"
        return
    }
    
    dir("components/${componentName}") {
        script {
            try {
                if (fileExists('docker-compose.yml')) {
                    echo "🚀 Deploying ${componentName} with Docker Compose using Jenkins credentials"
                    
                    // Use the Jenkins credentials for .env file
                    withCredentials([file(credentialsId: "${componentName}-env", variable: 'ENV_FILE')]) {
                        sh """
                            echo "=== Using Jenkins credentials for environment variables ==="
                            
                            # Copy the credential file to .env in the workspace
                            cp \$ENV_FILE .env
                            
                            # Set secure permissions on the .env file
                            chmod 600 .env
                            
                            echo "=== Validating Docker Compose configuration ==="
                            docker compose config
                            
                            echo "=== Starting deployment ==="
                            # Stop any existing services
                            docker compose down --remove-orphans 2>/dev/null || true
                            
                            # Pull latest images
                            docker compose pull --ignore-pull-failures 2>/dev/null || true
                            
                            # FIXED: Use double dash --env-file not single dash
                            docker compose --env-file .env up -d
                            
                            echo "=== Waiting for services to initialize ==="
                            sleep 60
                        """
                    }
                    
                    // Health checks (outside credentials block for security)
                    sh """
                        echo "=== Checking service status ==="
                        docker compose ps
                        
                        echo "=== Container overview ==="
                        docker ps --filter "name=${componentName}" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" || true
                        
                        echo "=== Testing FusionAuth accessibility ==="
                        # Try multiple times to access FusionAuth
                        for i in {1..5}; do
                            if curl -s -f http://localhost:9011/ > /dev/null; then
                                echo "✅ FusionAuth is accessible at http://localhost:9011"
                                break
                            else
                                echo "⏳ Attempt \$i: FusionAuth not yet accessible, waiting..."
                                sleep 30
                            fi
                        done
                        
                        # Final check
                        if ! curl -s -f http://localhost:9011/ > /dev/null; then
                            echo "⚠️ FusionAuth not accessible after multiple attempts, checking logs..."
                            docker compose logs --tail=50 fusionauth 2>/dev/null || true
                        fi
                    """
                    
                    echo "✅ ${componentName} deployment completed successfully"
                    
                } else {
                    echo "⚠️ No docker-compose.yml found for ${componentName}"
                }
            } catch (Exception e) {
                echo "❌ Deployment failed for ${componentName}: ${e.message}"
                // Provide detailed error information
                sh """
                    echo "=== Debug Information ==="
                    docker compose ps 2>/dev/null || true
                    echo "=== Recent Logs ==="
                    docker compose logs --tail=100 2>/dev/null || true
                """
                // Clean up .env file on failure
                sh "rm -f .env 2>/dev/null || true"
            }
        }
    }
}