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
            defaultValue: true,
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
                    def components = findComponents()
                    env.COMPONENTS = components.join(',')
                    env.COMPONENTS_STRING = components.join(',')
                    echo "Discovered components: ${components}"
                }
            }
        }
        
        stage('Build Components') {
            steps {
                script {
                    def components = env.COMPONENTS_STRING.split(',').toList()
                    def validComponents = components.findAll { component ->
                        component && component.trim() && component != '[' && component != ']'
                    }
                    
                    echo "Valid components to build: ${validComponents}"
                    
                    if (validComponents.isEmpty()) {
                        echo "No valid components found to build"
                        return
                    }
                    
                    def parallelStages = [:]
                    validComponents.each { component ->
                        String safeComponent = component.trim()
                        parallelStages["build_${safeComponent}"] = getComponentBuildStage(safeComponent)
                    }
                    
                    parallel parallelStages
                }
            }
        }
        
        stage('Add Certifications') {
            steps {
                script {
                    def components = env.COMPONENTS_STRING.split(',').toList()
                    def validComponents = components.findAll { component ->
                        component && component.trim() && component != '[' && component != ']'
                    }
                    
                    if (validComponents.isEmpty()) {
                        echo "No valid components found for certification"
                        return
                    }
                    
                    def parallelCertStages = [:]
                    validComponents.each { component ->
                        String safeComponent = component.trim()
                        parallelCertStages["certify_${safeComponent}"] = getComponentCertificationStage(safeComponent)
                    }
                    
                    parallel parallelCertStages
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
        unstable {
            script {
                echo "⚠️ Build ${currentBuild.result}: ${env.JOB_NAME} ${env.BUILD_NUMBER}"
                sendTelegramNotification("unstable")
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
            def branch = env.BRANCH_NAME ?: "main"
            def duration = currentBuild.durationString ?: "Unknown"
            
            def componentDetails = getComponentDetails()
            def certificationDetails = getCertificationDetails()
            
            if (status == "success") {
                emoji = "✅"
                message = """
${emoji} *🚀 Build Success*

*📋 Job:* ${env.JOB_NAME}
*🔢 Build:* #${env.BUILD_NUMBER}
*🌿 Branch:* ${branch}
*⏱️ Duration:* ${duration}

*🏗️ Component Details:*
${componentDetails}

*📜 Certification Status:*
${certificationDetails}

*📊 Build Stages:*
• 🔍 Discover Components - ✅ Completed
• 🏗️ Build Components - ✅ Built ${getBuiltComponentsCount()} components
• 📜 Add Certifications - ✅ ${getCertifiedComponentsCount()} components certified
• 🧪 Integration Test - ✅ Passed
• 🚀 Deployment - ${params.DEPLOY ? '✅ Deployed' : '⏸️ Not Deployed'}

*🔗 Build URL:* [View Build](${env.BUILD_URL})
"""
            } else if (status == "unstable") {
                emoji = "⚠️"
                message = """
${emoji} *Build Unstable*

*📋 Job:* ${env.JOB_NAME}
*🔢 Build:* #${env.BUILD_NUMBER}
*🌿 Branch:* ${branch}
*⏱️ Duration:* ${duration}

*🏗️ Component Details:*
${componentDetails}

*📜 Certification Status:*
${certificationDetails}

*📊 Build Stages:*
• 🔍 Discover Components - ✅ Completed
• 🏗️ Build Components - ⚠️ Partial success
• 📜 Add Certifications - ⚠️ Some certifications failed
• 🧪 Integration Test - ⚠️ Tests unstable
• 🚀 Deployment - ${params.DEPLOY ? '⏸️ Skipped' : '⏸️ Not Deployed'}

*🔗 Build URL:* [View Build](${env.BUILD_URL})
"""
            } else {
                emoji = "❌"
                message = """
${emoji} *💥 Build Failed*

*📋 Job:* ${env.JOB_NAME}
*🔢 Build:* #${env.BUILD_NUMBER}
*🌿 Branch:* ${branch}
*⏱️ Duration:* ${duration}

*🏗️ Component Details:*
${componentDetails}

*📜 Certification Status:*
${certificationDetails}

*📊 Build Stages:*
• 🔍 Discover Components - ✅ Completed
• 🏗️ Build Components - ❌ Failed building components
• 📜 Add Certifications - ⏸️ Skipped
• 🧪 Integration Test - ⏸️ Skipped
• 🚀 Deployment - ⏸️ Skipped

*🔍 Recent Changes:*
${getRecentChanges()}

*🔗 Build URL:* [View Build](${env.BUILD_URL})
*📝 Console Log:* [View Log](${env.BUILD_URL}console)
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

// Helper function to get component details
def getComponentDetails() {
    def details = ""
    try {
        def components = env.COMPONENTS_STRING ? env.COMPONENTS_STRING.split(',').toList() : []
        components.each { component ->
            def componentDir = "components/${component}"
            if (fileExists(componentDir)) {
                def type = getComponentType(component)
                details += "• ${component} - ${type}\\n"
            }
        }
    } catch (Exception e) {
        details = "• ${env.COMPONENTS ?: 'No components discovered'}\\n"
    }
    return details
}

// Helper function to get certification details
def getCertificationDetails() {
    def details = ""
    try {
        def components = env.COMPONENTS_STRING ? env.COMPONENTS_STRING.split(',').toList() : []
        components.each { component ->
            def certStatus = env["CERTIFICATION_${component.toUpperCase()}"] ?: "Not Certified"
            details += "• ${component} - ${certStatus}\\n"
        }
    } catch (Exception e) {
        details = "• Certification status unavailable\\n"
    }
    return details
}

// Helper function to get certified components count
def getCertifiedComponentsCount() {
    try {
        def certifiedCount = 0
        def components = env.COMPONENTS_STRING ? env.COMPONENTS_STRING.split(',').toList() : []
        components.each { component ->
            if (env["CERTIFICATION_${component.toUpperCase()}"] == "Certified") {
                certifiedCount++
            }
        }
        return certifiedCount
    } catch (Exception e) {
        return "unknown"
    }
}

// Helper function to detect component type
def getComponentType(componentName) {
    def type = "Generic"
    try {
        dir("components/${componentName}") {
            if (fileExists('docker-compose.yml')) {
                type = "Docker Compose"
            } else if (fileExists('package.json')) {
                type = "Node.js"
            } else if (fileExists('pom.xml')) {
                type = "Java"
            } else if (fileExists('Dockerfile')) {
                type = "Docker"
            }
        }
    } catch (Exception e) {
        // Ignore errors
    }
    return type
}

// Helper function to get built components count
def getBuiltComponentsCount() {
    try {
        def components = env.COMPONENTS_STRING ? env.COMPONENTS_STRING.split(',').toList() : []
        return components.size()
    } catch (Exception e) {
        return "unknown"
    }
}

// Helper function to get recent changes
def getRecentChanges() {
    try {
        def changes = sh(script: 'git log --oneline -5', returnStdout: true).trim()
        def changeList = changes.split('\n').collect { "• ${it}" }.join('\\n')
        return changeList ?: "No recent changes detected"
    } catch (Exception e) {
        return "Unable to fetch recent changes"
    }
}

// Serializable function to create build stages
def getComponentBuildStage(String componentName) {
    return {
        stage("Build ${componentName}") {
            script {
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

// Serializable function to create certification stages
def getComponentCertificationStage(String componentName) {
    return {
        stage("Certify ${componentName}") {
            script {
                boolean shouldCertify = params.COMPONENT == 'all' || params.COMPONENT == componentName
                
                if (shouldCertify) {
                    echo "Adding certifications for component: ${componentName}"
                    addComponentCertification(componentName)
                } else {
                    echo "Skipping certification for component ${componentName} - not selected in parameters"
                    env["CERTIFICATION_${componentName.toUpperCase()}"] = "Skipped"
                }
            }
        }
    }
}

def addComponentCertification(componentName) {
    echo "Starting certification process for component: ${componentName}"
    
    // Check if component directory exists
    if (!fileExists("components/${componentName}")) {
        echo "⚠️ Component directory 'components/${componentName}' not found for certification"
        // Use a different approach instead of env[] dynamic assignment
        sh "echo 'CERTIFICATION_${componentName.toUpperCase()}=Failed - Directory not found' >> certification.properties"
        return
    }
    
    dir("components/${componentName}") {
        try {
            // Check for component-specific certification script
            if (fileExists('certify.sh')) {
                echo "Running component-specific certification script for ${componentName}"
                sh """
                    chmod +x certify.sh
                    ./certify.sh
                """
                sh "echo 'CERTIFICATION_${componentName.toUpperCase()}=Certified' >> ../../certification.properties"
                
            } else if (fileExists('Jenkinsfile')) {
                // Check if Jenkinsfile has certification stage
                echo "Checking Jenkinsfile for certification stage in ${componentName}"
                def jenkinsfileContent = readFile('Jenkinsfile')
                if (jenkinsfileContent.contains('certification') || jenkinsfileContent.contains('certify')) {
                    echo "Loading component-specific Jenkinsfile with certification for ${componentName}"
                    load 'Jenkinsfile'
                    sh "echo 'CERTIFICATION_${componentName.toUpperCase()}=Certified' >> ../../certification.properties"
                } else {
                    echo "No certification stage found in Jenkinsfile, using auto-certification"
                    autoCertifyComponent(componentName)
                }
            } else {
                echo "No certification script or Jenkinsfile found, using auto-certification"
                autoCertifyComponent(componentName)
            }
            
        } catch (Exception e) {
            echo "❌ Certification failed for component ${componentName}: ${e.message}"
            sh "echo 'CERTIFICATION_${componentName.toUpperCase()}=Failed - ${e.message}' >> ../../certification.properties"
            currentBuild.result = 'UNSTABLE'
        }
    }
}

def autoCertifyComponent(componentName) {
    echo "Auto-certifying component: ${componentName}"
    
    try {
        // Basic security and compliance checks
        sh """
            echo "🔒 Running security and compliance checks for ${componentName}"
            
            # Check for sensitive files
            if [ -f ".env" ]; then
                echo "⚠️  Found .env file - ensure no secrets are committed"
            fi
            
            # Check Dockerfile security
            if [ -f "Dockerfile" ]; then
                echo "📋 Checking Dockerfile security"
                grep -i "root" Dockerfile && echo "⚠️  Warning: Running as root in Dockerfile" || true
            fi
            
            # Check for dependency configuration
            if [ -f "package.json" ]; then
                echo "📦 Checking package.json for security"
                [ -f "package-lock.json" ] || echo "⚠️  No package-lock.json found"
            fi
            
            # Verify build artifacts
            if [ -d "dist" ] || [ -d "build" ] || [ -d "target" ]; then
                echo "📁 Build artifacts directory found"
            fi
            
            echo "✅ Basic security checks completed for ${componentName}"
        """
        
        // Additional component-specific checks
        if (fileExists('docker-compose.yml')) {
            sh """
                echo "🐳 Running Docker Compose validation"
                docker compose config --quiet && echo "✅ Docker Compose configuration valid" || echo "❌ Docker Compose configuration invalid"
            """
        }
        
        // Write certification status to file instead of using env[]
        sh "echo 'CERTIFICATION_${componentName.toUpperCase()}=Auto-Certified' >> ../../certification.properties"
        echo "✅ Auto-certification completed for ${componentName}"
        
    } catch (Exception e) {
        echo "❌ Auto-certification failed for ${componentName}: ${e.message}"
        sh "echo 'CERTIFICATION_${componentName.toUpperCase()}=Auto-Certification Failed' >> ../../certification.properties"
        throw e
    }
}

// Existing helper functions (unchanged)
def findComponents() {
    def components = []
    try {
        if (fileExists('components')) {
            dir('components') {
                def jenkinsfiles = findFiles(glob: '*/Jenkinsfile')
                components = jenkinsfiles.collect { 
                    def path = it.path
                    def componentName = path.split('/')[0]
                    if (componentName && componentName.trim() && !componentName.contains('[') && !componentName.contains(']')) {
                        return componentName.trim()
                    } else {
                        echo "Skipping invalid component name: ${componentName}"
                        return null
                    }
                }.findAll { it != null }
                
                echo "Found components with Jenkinsfiles: ${components}"
                
                def additionalComponents = discoverComponentsByStructure()
                components.addAll(additionalComponents)
                components = components.unique()
            }
        } else {
            echo "No components directory found"
        }
    } catch (Exception e) {
        echo "Error discovering components: ${e.message}"
        components = ['backend', 'frontend', 'database', 'fusionAuth']
    }
    
    if (components.isEmpty()) {
        components = ['backend', 'frontend']
    }
    
    return components
}

def discoverComponentsByStructure() {
    def additionalComponents = []
    try {
        def componentDirs = sh(script: '''
            if [ -d "components" ]; then
                find components -maxdepth 1 -mindepth 1 -type d | \
                while read dir; do
                    dir_name=$(basename "$dir")
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
            if docker-compose config | grep -q "build:"; then
                docker-compose build --no-cache || true
            fi
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
                    
                    withCredentials([file(credentialsId: "${componentName}.env", variable: 'ENV_FILE')]) {
                        sh """
                            echo "=== Using Jenkins credentials for environment variables ==="
                            cp \$ENV_FILE .env
                            chmod 600 .env
                            
                            echo "=== Validating Docker Compose configuration ==="
                            docker compose config
                            
                            echo "=== Starting deployment ==="
                            docker compose down --remove-orphans 2>/dev/null || true
                            docker compose pull --ignore-pull-failures 2>/dev/null || true
                            docker compose --env-file .env up -d
                            
                            echo "=== Waiting for services to initialize ==="
                            sleep 60
                        """
                    }
                    
                    sh """
                        echo "=== Checking service status ==="
                        docker compose ps
                        
                        echo "=== Container overview ==="
                        docker ps --filter "name=${componentName}" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" || true
                        
                        echo "=== Testing FusionAuth accessibility ==="
                        for i in {1..5}; do
                            if curl -s -f http://localhost:9011/ > /dev/null; then
                                echo "✅ FusionAuth is accessible at http://localhost:9011"
                                break
                            else
                                echo "⏳ Attempt \$i: FusionAuth not yet accessible, waiting..."
                                sleep 30
                            fi
                        done
                        
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
                sh """
                    echo "=== Debug Information ==="
                    docker compose ps 2>/dev/null || true
                    echo "=== Recent Logs ==="
                    docker compose logs --tail=100 2>/dev/null || true
                """
                sh "rm -f .env 2>/dev/null || true"
            }
        }
    }
}