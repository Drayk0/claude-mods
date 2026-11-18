export type Deplie = boolean

declare module 'claude-code' {
  interface PluginState {
    'ranger-conv': { deplie: Deplie }
  }
}
