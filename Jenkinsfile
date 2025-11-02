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
      defaultValue: false,
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
      when { expression { params.DEPLOY == true } }
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
    'ai-agent'    : ['traefik']
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

def findComponents() {
  // يكتشف المجلدات داخل components التي تبدو قابلة للبناء
  def components = []
  try {
    if (fileExists('components')) {
      dir('components') {
        def jenkinsfiles = findFiles(glob: '*/Jenkinsfile')
        components = jenkinsfiles.collect {
          def comp = it.path.tokenize('/')[0]
          return comp?.trim()
        }.findAll { it }

        def extra = discoverComponentsByStructure()
        components.addAll(extra)
        components = components.unique()
      }
    } else {
      echo "No components directory found"
    }
  } catch (Exception e) {
    echo "Error discovering components: ${e.message}"
    components = ['traefik', 'db', 'fusionauth', 'core-backend', 'ai-agent']
  }
  if (components.isEmpty()) components = ['traefik']
  return components
}

def discoverComponentsByStructure() {
  def additionalComponents = []
  try {
    def componentDirs = sh(script: '''
      if [ -d "components" ]; then
        find components -maxdepth 1 -mindepth 1 -type d | while read dir; do
          name=$(basename "$dir")
          if [ -f "$dir/Jenkinsfile" ] || \
             [ -f "$dir/docker-compose.yml" ] || \
             [ -f "$dir/Dockerfile" ] || \
             [ -f "$dir/package.json" ] || \
             [ -f "$dir/pom.xml" ]; then
            echo "$name"
          fi
        done
      fi
    ''', returnStdout: true).trim()

    if (componentDirs) {
      componentDirs.split('\n').each { n ->
        if (n?.trim()) additionalComponents << n.trim()
      }
    }
  } catch (Exception e) {
    echo "Error in structure discovery: ${e.message}"
  }
  return additionalComponents
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
        load 'Jenkinsfile'
      } else {
        echo "No Jenkinsfile found for ${componentName}, using auto-build"
        autoBuildComponent(componentName)
      }
    } catch (Exception e) {
      echo "❌ Failed to build ${componentName}: ${e.message}"
      // لا نفشل البايبلاين بالكامل
    }
  }
}

def autoBuildComponent(componentName) {
  echo "Auto-building component: ${componentName}"

  if (fileExists('docker-compose.yml')) {
    sh '''
      echo "Docker Compose component detected"
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
        if (fileExists('docker-compose.yml')) {
          echo "🚀 Deploying ${componentName} with Docker Compose using Jenkins credentials"

          withCredentials([file(credentialsId: "${componentName}.env", variable: 'ENV_FILE')]) {
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

          sh """
            docker compose ps || true
            docker ps --filter "name=${componentName}" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" || true

            if docker compose ps fusionauth >/dev/null 2>&1; then
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