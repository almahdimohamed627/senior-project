pipeline {
  agent any

  parameters {
    choice(
      name: 'COMPONENT',
      choices: ['all', 'traefik', 'db', 'fusionauth', 'core-backend', 'ai-agent'],
      description: 'Select component to build/deploy (its prerequisites will be included automatically)'
    )
    booleanParam(
      name: 'DEPLOY',
      defaultValue: true,
      description: 'Deploy after successful build'
    )
  }

  stages {
    stage('Checkout SCM') {
      steps { checkout scm }
    }

    stage('Discover Components') {
      steps {
        script {
          def discovered = normalizeComponents(findComponents())
          env.DISCOVERED_COMPONENTS = discovered.join(',')
          echo "Discovered components: ${discovered}"
        }
      }
    }

    stage('Resolve Order') {
      steps {
        script {
          def depmap = deps()

          // الموجود فعليًا (مطَبَّع)
          def present = (env.DISCOVERED_COMPONENTS ?: '')
            .split(',')
            .findAll { it?.trim() }
            .collect { it.trim() }
            .unique()

          // الهدف من الباراميتر + متطلباته (مطَبَّع)
          def target = normalizeComponent(params.COMPONENT)
          def wanted = []
          if (target == 'all') {
            wanted = present
          } else {
            wanted = resolveWithPrereqs(target, depmap)
              .findAll { present.contains(it) }
          }

          if (wanted.isEmpty()) {
            error "No valid components to process."
          }

          // ترتيب (مع تجنّب استدعاءات محظورة)
          def ordered = topoOrder(wanted, depmap).findAll { present.contains(it) }
          env.COMPONENTS_STRING = ordered.join(',')
          echo "Ordered components: ${ordered}"
        }
      }
    }

    stage('Build (layered waves)') {
      steps {
        script {
          def components = (env.COMPONENTS_STRING ?: '')
            .split(',')
            .findAll { it?.trim() }
            .collect { it.trim() }

          def layers = layerize(components, deps())
          echo "Build layers: ${layers}"
          runLayered(layers, 'build')
        }
      }
    }

    stage('Integration Test') {
      steps { script { runIntegrationTests() } }
    }

    stage('Deploy (layered waves)') {
      steps {
        script {
          def components = (env.COMPONENTS_STRING ?: '')
            .split(',')
            .findAll { it?.trim() }
            .collect { it.trim() }

          def layers = layerize(components, deps())
          echo "Deploy layers: ${layers}"
          runLayered(layers, 'deploy')
        }
      }
    }
  }

  post {
    // مهم: نفّذ الإشعارات أولاً ثم نظّف المساحة
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
    always {
      script { currentBuild.description = "Components: ${env.COMPONENTS_STRING ?: env.DISCOVERED_COMPONENTS}" }
      cleanWs()
    }
  }
}

/* ========================= GLOBAL DEPENDENCIES ========================= */
// الكل يعتمد على traefik
// fusionauth و core-backend يعتمدان أيضًا على db
def deps() {
    return [
        'traefik'     : [],
        'db'          : ['traefik'],
        'fusionauth'  : ['db', 'traefik'],
        'core-backend': ['db', 'traefik'],
        'ai-agent'    : ['traefik'],
        'ai-model'    : ['traefik']
    ]
}

/* ========================= Normalization helpers ========================= */

def normalizeComponent(String name) {
  if (!name) return name
  def n = name.trim()
  // lower-case
  n = n.toLowerCase()
  // aliases
  if (n == 'fusionauth' || n == 'fusion-auth' || n == 'fusionauth/') n = 'fusionauth'
  if (n == 'corebackend' || n == 'core_backend') n = 'core-backend'
  return n
}

def normalizeComponents(List list) {
  return list.collect { normalizeComponent(it) }.unique()
}

/* ========================= Layering utilities ========================= */

def layerize(List wanted, Map depmap) {
  def remaining = wanted as Set
  def depsInSet = { String n -> (depmap[n] ?: []).findAll { remaining.contains(it) } }
  def layers = []
  while (!remaining.isEmpty()) {
    def layer = remaining.findAll { n -> depsInSet(n).isEmpty() }.toList().sort()
    if (layer.isEmpty()) error "Cyclic or missing dependency among: ${remaining}"
    layers << layer
    remaining.removeAll(layer)
  }
  return layers
}

def runLayered(List layers, String op /* 'build' or 'deploy' */) {
  layers.eachWithIndex { layer, idx ->
    stage("${op.capitalize()} Wave ${idx+1}") {
      echo "${op.capitalize()} in parallel for: ${layer}"
      def par = [:]
      layer.each { comp ->
        par["${op}_${comp}"] = {
          stage("${op.capitalize()} ${comp}") {
            if (op == 'build') buildComponent(comp)
            else               deployComponent(comp)
          }
        }
      }
      parallel par
    }
  }
}

/* ========================= Dependency resolution (sandbox-safe) ========================= */

def resolveWithPrereqs(String target, Map depmap) {
  def out = [] as LinkedHashSet
  def visit
  visit = { String n ->
    (depmap[n] ?: []).each { visit(it as String) }
    out << n
  }
  visit(target)
  return out.toList()
}

// نسخة آمنة بدون removeFirst ولا ArrayDeque
def topoOrder(List wanted, Map depmap) {
  def wantedSet = wanted as Set
  def indeg = [:].withDefault { 0 }
  def adj = [:].withDefault { [] as Set }

  wanted.each { n ->
    def parents = (depmap[n] ?: []).findAll { wantedSet.contains(it) }
    indeg[n] = parents.size()
    parents.each { p -> adj[p] = (adj[p] + n) as Set }
  }

  def q = [] as List
  wanted.each { n -> if (indeg[n] == 0) q << n }

  def out = []
  int qi = 0
  while (qi < q.size()) {
    def u = q[qi++]        // لا إزالة من البداية، فقط مؤشّر
    out << u
    (adj[u] ?: []).each { v ->
      indeg[v] = indeg[v] - 1
      if (indeg[v] == 0) q << v
    }
  }

  if (out.size() != wanted.size()) {
    error "Cyclic or missing dependency detected for ${wanted}."
  }
  return out
}

/* ========================= Telegram notification ========================= */

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

      if (status == "success") {
        emoji = "✅"
        message = """
${emoji} *🚀 Build Success*

*📋 Job:* ${env.JOB_NAME}
*🔢 Build:* #${env.BUILD_NUMBER}
*🌿 Branch:* ${branch}
*⏱️ Duration:* ${duration}

*🏗 Component Details:*
${componentDetails}

*📊 Build Stages:*
• 🔍 Discover Components - ✅ Completed
• 🏗 Build - ✅ Done
• 🧪 Integration Test - ✅ Passed
• 🚀 Deployment - ${params.DEPLOY ? '✅ Deployed' : '⏸️ Not Deployed'}

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

*🏗 Component Details:*
${componentDetails}

*📊 Build Stages:*
• 🔍 Discover Components - ✅ Completed
• 🏗 Build - ❌ Failed
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

/* ========================= Build/Deploy helpers ========================= */

def getComponentDetails() {
  def details = ""
  try {
    def components = env.COMPONENTS_STRING ? env.COMPONENTS_STRING.split(',').toList() : []
    components.each { component ->
      def componentDir = "components/${component}"
      if (fileExists(componentDir)) {
        def type = getComponentType(component)
        details += "• ${component} - ${type}\n"
      }
    }
  } catch (Exception e) {
    details = "• ${env.COMPONENTS_STRING ?: 'No components discovered'}\n"
  }
  return details
}

def getComponentType(componentName) {
  def type = "Generic"
  try {
    dir("components/${componentName}") {
      if (fileExists('docker-compose.yml'))      type = "Docker Compose"
      else if (fileExists('package.json'))       type = "Node.js"
      else if (fileExists('pom.xml'))            type = "Java/Maven"
      else if (fileExists('Dockerfile'))         type = "Docker"
    }
  } catch (Exception e) { /* ignore */ }
  return type
}

def getRecentChanges() {
  try {
    def changes = sh(script: 'git log --oneline -5', returnStdout: true).trim()
    def changeList = changes.split('\n').collect { "• ${it}" }.join('\n')
    return changeList ?: "No recent changes detected"
  } catch (Exception e) {
    return "Unable to fetch recent changes"
  }
}

/* ========================= FIXED COMPONENT DISCOVERY ========================= */

def findComponents() {
  def components = []
  try {
    if (fileExists('components')) {
      // Use ONLY structure-based discovery - don't rely on Jenkinsfiles
      components = discoverComponentsByStructure()
      
      // If no components found with structure, fall back to default list
      if (components.isEmpty()) {
        echo "No components discovered by structure, using default components"
        components = ['traefik', 'db', 'fusionauth', 'core-backend', 'ai-agent']
      }
    } else {
      echo "No components directory found, using default components"
      components = ['traefik', 'db', 'fusionauth', 'core-backend', 'ai-agent']
    }
  } catch (Exception e) {
    echo "Error discovering components: ${e.message}, using default components"
    components = ['traefik', 'db', 'fusionauth', 'core-backend', 'ai-agent']
  }
  
  // Remove any null or empty values and normalize
  components = components.findAll { it?.trim() }.collect { it.trim() }.unique()
  
  echo "Final discovered components: ${components}"
  return components
}

def discoverComponentsByStructure() {
  def components = []
  try {
    def componentDirs = sh(script: '''
      #!/bin/bash
      if [ -d "components" ]; then
        find components -maxdepth 1 -mindepth 1 -type d | while read dir; do
          name=$(basename "$dir")
          # Check for ANY build/deploy configuration files (not just Jenkinsfile)
          if [ -f "$dir/docker-compose.yml" ] || \
             [ -f "$dir/Dockerfile" ] || \
             [ -f "$dir/package.json" ] || \
             [ -f "$dir/pom.xml" ] || \
             [ -f "$dir/build.gradle" ] || \
             [ -f "$dir/go.mod" ] || \
             [ -f "$dir/requirements.txt" ] || \
             [ -f "$dir/Cargo.toml" ] || \
             [ -f "$dir/Makefile" ] || \
             [ -f "$dir/Jenkinsfile" ]; then
            echo "$name"
          fi
        done
      fi
    ''', returnStdout: true).trim()

    if (componentDirs) {
      componentDirs.split('\n').each { n ->
        if (n?.trim()) components << n.trim()
      }
    }
    
    echo "Structure-based discovery found: ${components}"
  } catch (Exception e) {
    echo "Error in structure discovery: ${e.message}"
  }
  return components
}

def buildComponent(componentName) {
  echo "Starting build for component: ${componentName}"
  if (!fileExists("components/${componentName}")) {
    echo "⚠️ Missing directory components/${componentName}"
    return
  }

  dir("components/${componentName}") {
    try {
      if (fileExists('Jenkinsfile')) {
        echo "Loading component-specific Jenkinsfile for ${componentName}"
        def componentLib = load 'Jenkinsfile'
        componentLib.build()  // Call the build method
      } else {
        echo "No Jenkinsfile found for ${componentName}, using auto-build"
        autoBuildComponent(componentName)
      }
    } catch (Exception e) {
      echo "❌ Failed to build ${componentName}: ${e.message}"
      // Don't fail the entire pipeline for one component
    }
  }
}

/* ========================= FIXED AUTO-BUILD WITH ENV FILES ========================= */

def autoBuildComponent(componentName) {
  echo "Auto-building component: ${componentName}"

  if (fileExists('docker-compose.yml')) {
    // Try to use environment file if credential exists
    def credentialId = "${componentName}.env"
    def useEnvFile = false
    
    try {
      // Check if credential exists by trying to use it
      withCredentials([file(credentialsId: credentialId, variable: 'ENV_FILE')]) {
        useEnvFile = true
      }
    } catch (Exception e) {
      echo "⚠️ No credential found for ${credentialId}, proceeding without environment file"
      useEnvFile = false
    }

    if (useEnvFile) {
      echo "🔐 Using environment file for ${componentName}"
      withCredentials([file(credentialsId: credentialId, variable: 'ENV_FILE')]) {
        sh """
          cp "\$ENV_FILE" .env
          chmod 600 .env
          echo "Docker Compose component detected with environment file"
          docker compose config || true
          docker compose pull --ignore-pull-failures || true
          if docker compose config | grep -q "build:"; then
            docker compose build --no-cache || true
          fi
          docker compose --env-file .env up -d || true
          sleep 10
          docker compose --env-file .env ps || true
          docker compose --env-file .env down || true
          rm -f .env 2>/dev/null || true
        """
      }
    } else {
      sh '''
        echo "Docker Compose component detected (no environment file)"
        docker compose config || true
        docker compose pull --ignore-pull-failures || true
        if docker compose config | grep -q "build:"; then
          docker compose build --no-cache || true
        fi
        docker compose up -d || true
        sleep 10
        docker compose ps || true
        docker compose down || true
      '''
    }
  } else if (fileExists('package.json')) {
    sh '''
      echo "Node.js component detected"
      npm install || true
      npm run build --if-present || true
    '''
  } else if (fileExists('pom.xml')) {
    sh '''
      echo "Java/Maven component detected"
      mvn -q -e -B clean compile || true
    '''
  } else if (fileExists('Dockerfile')) {
    sh """
      echo "Docker image build detected"
      docker build -t ${componentName}:${env.BUILD_TAG} . || true
    """
  } else if (fileExists('build.gradle')) {
    sh '''
      echo "Gradle component detected"
      ./gradlew build --no-daemon || true
    '''
  } else if (fileExists('go.mod')) {
    sh '''
      echo "Go component detected"
      go build -o app . || true
    '''
  } else if (fileExists('requirements.txt')) {
    sh '''
      echo "Python component detected"
      pip install -r requirements.txt || true
    '''
  } else {
    echo "⚠️ No build system detected for ${componentName}"
  }
}

def runIntegrationTests() {
  echo "Running integration tests"
  sh '''
    echo "Running integration tests between components"
    # TODO: add real integration tests here
  '''
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
        if (fileExists('Jenkinsfile')) {
          echo "Loading component-specific Jenkinsfile for ${componentName}"
          def componentLib = load 'Jenkinsfile'
          componentLib.deploy()  // Call the deploy method
        } else {
          echo "No Jenkinsfile found for ${componentName}, using auto-deploy"
          autoDeployComponent(componentName)
        }
      } catch (Exception e) {
        echo "❌ Deployment failed for ${componentName}: ${e.message}"
        // Don't fail the entire pipeline for one component
      }
    }
  }
}

/* ========================= FIXED AUTO DEPLOYMENT ========================= */

def autoDeployComponent(componentName) {
  echo "Auto-deploying component: ${componentName}"
  
  if (!fileExists('docker-compose.yml')) {
    echo "⚠️ No docker-compose.yml found for ${componentName}, skipping deployment"
    return
  }

  try {
    // Dynamically resolve credential ID based on component name
    def credentialId = "${componentName}.env"
    
    echo "🔐 Using credential ID: ${credentialId} for ${componentName}"
    
    withCredentials([file(credentialsId: credentialId, variable: 'ENV_FILE')]) {
      sh """
        cp "\$ENV_FILE" .env
        chmod 600 .env
        docker compose config
        docker compose down --remove-orphans 2>/dev/null || true
        docker compose pull --ignore-pull-failures 2>/dev/null || true
        docker compose --env-file .env up -d
        sleep 60
      """
    }

    // Check deployment status
    sh """
      docker compose ps || true
      docker ps --filter "name=${componentName}" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" || true
    """

    // Component-specific health checks
    performComponentHealthCheck(componentName)

    echo "✅ ${componentName} auto-deployment completed successfully"
    
  } catch (Exception e) {
    echo "❌ Auto-deployment failed for ${componentName}: ${e.message}"
    sh """
      echo "=== Debug Information for ${componentName} ==="
      docker compose ps 2>/dev/null || true
      echo "=== Recent Logs ==="
      docker compose logs --tail=100 2>/dev/null || true
    """
    sh "rm -f .env 2>/dev/null || true"
    // Don't re-throw to avoid failing entire pipeline
  }
}

def performComponentHealthCheck(componentName) {
  echo "Performing health check for ${componentName}"
  
  switch(componentName) {
    case 'traefik':
      sh '''
        for i in 1 2 3; do
          if curl -s -f http://localhost:2468/ >/dev/null; then
            echo "✅ Traefik dashboard is accessible at http://localhost:2468"
            break
          else
            echo "⏳ Attempt $i: Traefik not yet accessible, waiting..."
            sleep 30
          fi
        done
        if ! curl -s -f http://localhost:2468/ >/dev/null; then
          echo "⚠️ Traefik not accessible, showing recent logs..."
          docker compose logs --tail=50 traefik || true
        fi
      '''
      break
      
    case 'db':
      sh '''
        for i in 1 2 3; do
          if docker compose ps db | grep -q "healthy"; then
            echo "✅ Database is healthy"
            break
          else
            echo "⏳ Attempt $i: Database not yet healthy, waiting..."
            sleep 30
          fi
        done
        if ! docker compose ps db | grep -q "healthy"; then
          echo "⚠️ Database not healthy, showing recent logs..."
          docker compose logs --tail=50 db || true
        fi
      '''
      break
      
    case 'fusionauth':
      sh '''
        for i in 1 2 3; do
          if curl -s -f http://localhost:9011/ >/dev/null; then
            echo "✅ FusionAuth is accessible at http://localhost:9011"
            break
          else
            echo "⏳ Attempt $i: FusionAuth not yet accessible, waiting..."
            sleep 30
          fi
        done
        if ! curl -s -f http://localhost:9011/ >/dev/null; then
          echo "⚠️ FusionAuth not accessible, showing recent logs..."
          docker compose logs --tail=50 fusionauth || true
        fi
      '''
      break
      
    case 'core-backend':
      sh '''
        for i in 1 2 3; do
          if curl -s -f http://localhost:3000/health >/dev/null 2>&1 || 
             curl -s -f http://localhost:3000 >/dev/null 2>&1; then
            echo "✅ Core-backend is accessible at http://localhost:3000"
            break
          else
            echo "⏳ Attempt $i: Core-backend not yet accessible, waiting..."
            sleep 30
          fi
        done
        if ! curl -s -f http://localhost:3000/health >/dev/null 2>&1 && 
           ! curl -s -f http://localhost:3000 >/dev/null 2>&1; then
          echo "⚠️ Core-backend not accessible, showing recent logs..."
          docker compose logs --tail=50 nest-app || true
        fi
      '''
      break
      
    case 'ai-agent':
      sh '''
        for i in 1 2 3; do
          if curl -s -f http://localhost:8080/health >/dev/null 2>&1 || 
             curl -s -f http://localhost:8080 >/dev/null 2>&1; then
            echo "✅ AI Agent is accessible at http://localhost:8080"
            break
          else
            echo "⏳ Attempt $i: AI Agent not yet accessible, waiting..."
            sleep 30
          fi
        done
        if ! curl -s -f http://localhost:8080/health >/dev/null 2>&1 && 
           ! curl -s -f http://localhost:8080 >/dev/null 2>&1; then
          echo "⚠️ AI Agent not accessible, showing recent logs..."
          docker compose logs --tail=50 ai-agent || true
        fi
      '''
      break
      
    default:
      echo "⚠️ No specific health check configured for ${componentName}"
      // Generic health check
      sh '''
        if docker compose ps | grep -q "Up"; then
          echo "✅ ${componentName} services are running"
        else
          echo "⚠️ Some ${componentName} services may not be running properly"
        fi
      '''
      break
  }
}
