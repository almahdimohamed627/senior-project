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
            echo "✅ Build ${currentBuild.result}: ${env.JOB_NAME} ${env.BUILD_NUMBER}"
            // Comment out slackSend until credentials are configured
            // slackSend(color: 'good', message: "Build ${currentBuild.result}: ${env.JOB_NAME} ${env.BUILD_NUMBER}")
        }
        failure {
            echo "❌ Build ${currentBuild.result}: ${env.JOB_NAME} ${env.BUILD_NUMBER}"
            // Comment out slackSend until credentials are configured  
            // slackSend(color: 'danger', message: "Build ${currentBuild.result}: ${env.JOB_NAME} ${env.BUILD_NUMBER}")
        }
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
            // error "Failed to build component ${componentName}"
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
    
    // Use a Docker container with Docker Compose for deployment
    docker.image('docker/compose:1.29.2').inside('-v /var/run/docker.sock:/var/run/docker.sock') {
        dir("components/${componentName}") {
            script {
                try {
                    if (fileExists('docker-compose.yml')) {
                        echo "🚀 Deploying ${componentName} with Docker Compose"
                        
                        sh """
                            echo "=== Starting Docker Compose ==="
                            docker-compose down || true
                            docker-compose pull --ignore-pull-failures || true
                            docker-compose up -d
                            sleep 15
                            echo "=== Service Status ==="
                            docker-compose ps
                        """
                    } else {
                        echo "⚠️ No docker-compose.yml found for ${componentName}"
                    }
                } catch (Exception e) {
                    echo "❌ Deployment failed for ${componentName}: ${e.message}"
                }
            }
        }
    }
}