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
                }
            }
        }
        
        stage('Build Components') {
            parallel {
                stage('Build Backend') {
                    when { 
                        anyOf { 
                            expression { params.COMPONENT == 'all' || params.COMPONENT == 'backend' }
                            changeset 'components/backend/**'
                        }
                    }
                    steps {
                        buildComponent('backend')
                    }
                }
                
                stage('Build Frontend') {
                    when { 
                        anyOf { 
                            expression { params.COMPONENT == 'all' || params.COMPONENT == 'frontend' }
                            changeset 'components/frontend/**'
                        }
                    }
                    steps {
                        buildComponent('frontend')
                    }
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
    dir('components') {
        components = findFiles(glob: '*/Jenkinsfile').collect { 
            it.path.split('/')[0] 
        }
    }
    return components
}

def buildComponent(componentName) {
    dir("components/${componentName}") {
        // Load component-specific Jenkinsfile
        loadJenkinsfile("components/${componentName}/Jenkinsfile")
    }
}