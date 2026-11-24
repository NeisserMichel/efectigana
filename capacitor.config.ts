import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'pe.efectigana.app',
  appName: 'EfectiGana',
  webDir: 'dist',
  backgroundColor: '#062a20',
  android: {
    allowMixedContent: false,
  },
}

export default config
