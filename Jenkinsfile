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
                    // Dynamically discover components
                    def components = findComponents()
                    env.COMPONENTS = components.join(',')
                    env.COMPONENTS_LIST = components // Store as list for later use
                }
            }
        }
        
        stage('Build Components') {
            steps {
                script {
                    // Create parallel stages dynamically
                    def parallelStages = [:]
                    
                    env.COMPONENTS_LIST.each { component ->
                        parallelStages["Build ${component}"] = {
                            stage("Build ${component}") {
                                when { 
                                    anyOf { 
                                        expression { 
                                            params.COMPONENT == 'all' || params.COMPONENT == component 
                                        }
                                        changeset "components/${component}/**"
                                    }
                                }
                                steps {
                                    script {
                                        buildComponent(component)
                                    }
                                }
                            }
                        }
                    }
                    
                    // Execute all parallel stages
                    parallel parallelStages
                }
            }
        }
        
        stage('Integration Test') {
            steps {
                runIntegrationTests()
            }
        }
        
        stage('Deploy') {
            when { 
                expression { params.DEPLOY == true }
            }
            steps {
                deployComponents()
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
            slackSend(color: 'good', message: "Build ${currentBuild.result}: ${env.JOB_NAME} ${env.BUILD_NUMBER}")
        }
        failure {
            slackSend(color: 'danger', message: "Build ${currentBuild.result}: ${env.JOB_NAME} ${env.BUILD_NUMBER}")
        }
    }
}

// Helper functions
def findComponents() {
    def components = []
    if (fileExists('components')) {
        dir('components') {
            def jenkinsfiles = findFiles(glob: '*/Jenkinsfile')
            components = jenkinsfiles.collect { 
                it.path.split('/')[0] 
            }
        }
    } else {
        echo "No components directory found"
    }
    return components ?: ['backend', 'frontend'] // fallback to default components
}

def buildComponent(componentName) {
    echo "Building component: ${componentName}"
    dir("components/${componentName}") {
        // Load component-specific Jenkinsfile
        if (fileExists('Jenkinsfile')) {
            load 'Jenkinsfile'
        } else {
            echo "No Jenkinsfile found for component ${componentName}, using default build"
            // Add default build steps for components without Jenkinsfile
            sh '''
                echo "Building ${componentName} with default steps"
                # Add your default build commands here
                if [ -f "package.json" ]; then
                    npm install
                    npm run build
                elif [ -f "pom.xml" ]; then
                    mvn clean compile
                elif [ -f "docker-compose.yml" ]; then
                    docker-compose build
                fi
            '''
        }
    }
}

def runIntegrationTests() {
    echo "Running integration tests"
    // Add your integration test logic here
    sh '''
        echo "Running integration tests between components"
        # docker-compose -f docker-compose.test.yml up -d
        # ./run-integration-tests.sh
        # docker-compose -f docker-compose.test.yml down
    '''
}

def deployComponents() {
    echo "Deploying components"
    script {
        if (params.COMPONENT == 'all') {
            // Deploy all components
            env.COMPONENTS_LIST.each { component ->
                deployComponent(component)
            }
        } else {
            // Deploy specific component
            deployComponent(params.COMPONENT)
        }
    }
}

def deployComponent(componentName) {
    echo "Deploying component: ${componentName}"
    dir("components/${componentName}") {
        // Add component-specific deployment logic
        sh """
            echo "Deploying ${componentName}"
            # Add your deployment commands here
            # kubectl apply -f k8s/
            # docker-compose up -d
            # ./deploy.sh
        """
    }
}