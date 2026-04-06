// hooks/scripts/cli.mjs
// AI Watchman CLI entry point for hook events

import { loadSettings } from '../../utils/settings.mjs'
import { createLogWriter } from '../../utils/log.mjs'
import { sendRequest } from '../../utils/request.mjs'

const args = readFlags(process.argv.slice(2))
const settings = loadSettings(args)
const log = createLogWriter('watchman.log', settings)

switch (args.commands[0] || 'help') {
  case 'help':
    console.log('Usage: node cli.mjs <command> [--endpoint URL] [--project NAME]')
    console.log('Commands: ingest')
    console.log('  ingest: Send a trigger to the service')
    process.exit(0)
  case 'ingest':
    ingestCommand()
    break
  default:
    console.error(`Unknown: ${args.commands[0]}`)
    console.error('Usage: node cli.mjs <ingest> [--endpoint URL] [--project NAME]')
    process.exit(1)
}

function ingestCommand() {
  log.trace('Ingest command')

  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => { input += chunk })
  process.stdin.on('end', () => {
    if (!input.trim()) {
      log.trace('Empty input')
      return
    }

    let body
    try {
      body = JSON.parse(input)
    } catch (err) {
      log.alert(`Parse error: ${err.message}`)
      return
    }

    const trigger = body.hook_event_name || 'unknown'
    const tool = body.tool_name || ''
    log.verbose(`Trigger: ${trigger}${tool ? ` tool=${tool}` : ''}`)

    const envelope = { data: body, context: {} }
    if (settings.project) {
      envelope.context.project = settings.project
    }

    sendRequest(`${settings.apiUrl}/ingest`, envelope, {
      fireAndForget: true,
      log,
    })
      .then((result) => {
        if (result.status === 0) {
          log.error(`Unreachable: ${settings.origin}`)
          return
        }
        log.trace(`Response: ${result.status}`)
      })
      .catch((err) => {
        log.error(`Failed: ${err.message}`)
      })
  })
}

function readFlags(argv) {
  const parsed = { commands: [], endpoint: null, project: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--endpoint' && argv[i + 1]) {
      parsed.endpoint = argv[i + 1]
      i++
    } else if (argv[i] === '--project' && argv[i + 1]) {
      parsed.project = argv[i + 1]
      i++
    } else if (!argv[i].startsWith('-')) {
      parsed.commands.push(argv[i])
    }
  }
  return parsed
}