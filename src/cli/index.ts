import { version } from '../../package.json'

interface CliOptions {
  version?: boolean
  help?: boolean
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {}

  for (const arg of args) {
    if (arg === '-v' || arg === '--version') {
      options.version = true
    } else if (arg === '-h' || arg === '--help') {
      options.help = true
    }
  }

  return options
}

export function showHelp(): void {
  console.log(`
Usage: package-template [options]

Options:
  -v, --version  Show version number
  -h, --help     Show help
`)
}

export function showVersion(): void {
  console.log(`v${version}`)
}

export function cli(args: string[] = process.argv.slice(2)): void {
  const options = parseArgs(args)

  if (options.version) {
    showVersion()
  } else if (options.help) {
    showHelp()
  } else {
    showHelp()
  }
}
