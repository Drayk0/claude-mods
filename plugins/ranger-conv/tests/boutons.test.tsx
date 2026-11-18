import { expect, test } from 'claude-code/testing'

const PIED = { plugin: 'ranger-conv', component: 'SessionMode', props: { modes: [] }, surface: 'desktop' } as const

// Ce qui se trouve sous le mod : l'appli, qui répond aux appels et dessine son propre pied.
const appli = (on: Parameters<Parameters<typeof test>[1]>[1], brouillon: string) => {
  const envoyes: string[] = []
  const remplis: string[] = []
  on('prompt.read', () => ({ value: { text: brouillon, cursor: 0 } }))
  on('prompt.submit', (_, e) => {
    envoyes.push(e.text)
    return { text: e.text }
  })
  on('prompt.fill', (_, e) => {
    remplis.push(e.text)
    return { isFilled: true, text: e.text }
  })
  on('ui.toast', () => ({ value: {} }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>appli</Text>
  })
  return { envoyes, remplis }
}

test('Mieux remplace le brouillon par la réécriture', async ($, on) => {
  const { remplis } = appli(on, 'fai le truc stp')
  on('model.fork', () => ({ value: { isAnswered: true, text: ' Fais le truc, s’il te plaît. ', usage: {} } }))

  const ui = await $.ui.mount(PIED)
  await ui.press({ key: 'mieux' })
  expect(remplis).toEqual(['Fais le truc, s’il te plaît.'])
  await ui.unmount()
})

test('⋯ déplie Retiens / Vider / Archiver, Retiens envoie le brouillon, puis la ligne se replie', async ($, on) => {
  const { envoyes, remplis } = appli(on, 'toujours en français')
  const attentes: (() => void)[] = []
  const fin = () => attentes.forEach(ok => ok())
  on('clock.sleep', () => new Promise(ok => attentes.push(() => ok({ value: undefined }))))

  const ui = await $.ui.mount(PIED)
  const attente = ui.press({ key: 'menu' })
  await new Promise(ok => setTimeout(ok, 20))
  expect(await ui.find({ key: 'mieux' })).toBeUndefined()
  await ui.press({ key: 'retiens' })
  expect(envoyes.length).toBe(1)
  expect(envoyes[0]).toContain('« toujours en français »')
  expect(remplis).toEqual([''])
  // Replié tout de suite après le choix.
  expect(await ui.find({ key: 'mieux' })).toBeDefined()
  fin()
  await attente
  await ui.unmount()
})

test('/retiens, /vider et /archiver envoient leur consigne', async ($, on) => {
  const { envoyes } = appli(on, '')
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.sleep', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'retiens', args: 'réponses courtes' })
  await $.command.run({ command: 'vider', args: '' })
  await new Promise(ok => setTimeout(ok, 50))
  expect(envoyes[0]).toContain('« réponses courtes »')
  expect(envoyes[1]).toContain('Vider la conv')
})
