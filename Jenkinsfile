pipeline {
    agent any
    parameters {
        choice(
            name: 'COMPONENT',
            choices: ['all', 'backend', 'frontend', 'database', 'fusionAuth'],
            description: 'Select component to build'
        )
    }
    
    stages {
        stage('Build Components') {
            steps {
                script {
                    // Simple static component list for now
                    def components = ['backend', 'frontend']
                    
                    def builds = [:]
                    components.each { component ->
                        if (params.COMPONENT == 'all' || params.COMPONENT == component) {
                            builds["Build ${component}"] = {
                                echo "Building ${component}"
                                sh "echo 'Build ${component} completed'"
                            }
                        }
                    }
                    parallel builds
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
            echo "Build completed with status: ${currentBuild.result}"
        }
    }
}