import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

// Ligne du modèle (pied de la saisie) : « Mieux » en un clic, « ⋯ » déplie Retiens / Vider / Archiver
// sur la même ligne, qui se replie après un choix ou 8 s. Aussi en commandes /retiens, /vider, /archiver.
// Le pied coupe vers 24 caractères ; la ligne sous la saisie (PromptHint) n'est pas dessinée par le bureau,
// et le bandeau au-dessus (AbovePrompt) est laissé libre pour les autres mods.
// Vider / Archiver envoient une consigne à Claude : mettre sa mémoire à jour, puis vider ou archiver la conversation.
// Supprimer n'est pas possible depuis la conversation elle-même (l'appli l'interdit) : on archive.

const MEMOIRE =
  "si tu as une mémoire persistante (dossier mémoire décrit dans tes consignes), vérifie qu'elle contient tout ce qui compte " +
  "dans cette conversation (décisions, préférences de l'utilisateur, état des projets, choses à faire) " +
  "et complète-la si besoin, sans rien redemander ; sinon passe cette étape. "

const CONSIGNES = {
  vider:
    "Bouton « Vider la conv » : " +
    MEMOIRE +
    'Ensuite, appelle clear_session avec session_id "self". ' +
    "Si c'est refusé à cause de Remote Control, coupe Remote Control sur cette session (set_remote_control, enabled false) et réessaie. " +
    'Réponds en une ligne, sans boîte « prochaine étape ».',
  archiver:
    "Bouton « Archiver la conv » : " +
    MEMOIRE +
    'Ensuite, renomme la conversation (set_session_title, session_id "self") pour résumer ce qui y a été fait, ' +
    "au format « Projet : ce qu'on a fait », en français, 35 à 55 caractères, le projet en premier ; " +
    "si elle a couvert deux sujets, cite les deux. " +
    'Puis appelle archive_session avec session_id "self". ' +
    "Si c'est refusé à cause de Remote Control, coupe-le sur cette session (set_remote_control, enabled false) et réessaie. " +
    "Si c'est refusé à cause de « Garder l'ordinateur allumé » : aucun outil ne peut le couper, l'appli le réserve à l'utilisateur. " +
    "Dis-lui seulement en une ligne de le couper dans le menu de la session puis de recliquer sur Archiver, " +
    "ou d'archiver depuis la barre latérale. " +
    'Réponds en une ligne, sans boîte « prochaine étape ».',
} as const

type Action = keyof typeof CONSIGNES

// « Retiens » : le texte de la saisie s'il y en a, sinon la dernière correction de l'utilisateur.
const consigneRetiens = (brouillon: string) =>
  'Bouton « Retiens ça » : ' +
  (brouillon
    ? `l'utilisateur veut que tu retiennes ceci : « ${brouillon} ». `
    : "retiens la dernière correction ou consigne que l'utilisateur t'a donnée dans cette conversation. ") +
  'Si tu as une mémoire persistante (dossier mémoire décrit dans tes consignes), écris-la comme note de type feedback ' +
  "(avec Why et How to apply), en complétant la note existante si elle couvre déjà le sujet, sinon dans une nouvelle note avec sa ligne dans l'index. " +
  'Sinon, ajoute-la en une ligne dans ~/.claude/CLAUDE.md (crée le fichier s\'il n\'existe pas). ' +
  "S'il n'y a rien de clair à retenir, dis-le. " +
  'Réponds en une ligne avec ce que tu as retenu et dans quelle note, sans boîte « prochaine étape ».'

// « Mieux » : réécrit le brouillon dans la case, sans l'envoyer.
const REGLES_MIEUX =
  "réécris-le pour qu'il soit clair et sans ambiguïté : corrige les fautes, mets les demandes en ordre, " +
  'précise ce qui est vague quand le contexte le rend évident. Garde son ton, le français, le tutoiement ' +
  "et toutes ses demandes ; n'ajoute aucune demande ni supposition, et ne réponds pas à la demande. " +
  "Tu n'as pas d'outils : réponds tout de suite, avec seulement le texte réécrit, sans guillemets ni commentaire."

// Mieux tourne sur Haiku (moins cher) avec seulement la fin de la conversation, pas toute.
const CONTEXTE_MESSAGES = 12
const CONTEXTE_CARACTERES = 12000

async function finDeConversation($: EngineInterface) {
  const messages = await $.session.messages({ last: CONTEXTE_MESSAGES })
  if ('deny' in messages) {
    return ''
  }
  return messages
    .filter(m => m.text.trim())
    .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Claude'} : ${m.text.trim()}`)
    .join('\n\n')
    .slice(-CONTEXTE_CARACTERES)
}

const deplie = atom({ plugin: 'ranger-conv', key: 'deplie' } as const, false)
const REPLI_MS = 8000

// Évite d'envoyer deux fois la même consigne sur un double-clic.
let envoye: Action | null = null
let reecriture = false
// Chaque dépliage a son jeton : seul le dernier replie la ligne à la fin de son délai.
let jeton = 0

async function envoyer($: EngineInterface, action: Action) {
  if (envoye) {
    return
  }
  envoye = action
  $.ui.toast(action === 'vider' ? 'Mémoire puis vidage…' : 'Mémoire puis archivage…')
  await $.prompt.submit({ text: CONSIGNES[action] })
}

async function retiens($: EngineInterface, brouillon: string) {
  $.ui.toast('Mémoire…')
  await $.prompt.submit({ text: consigneRetiens(brouillon) })
}

async function mieux($: EngineInterface) {
  if (reecriture) {
    return
  }
  const { text } = await $.prompt.read()
  if (!text.trim()) {
    $.ui.toast('Rien à améliorer')
    return
  }
  reecriture = true
  $.ui.toast('Réécriture…')
  try {
    const brouillon = `L'utilisateur a écrit ce brouillon dans la case de saisie, pas encore envoyé :\n<brouillon>\n${text}\n</brouillon>\n`
    // La fin de la conversation aide à lever les ambiguïtés du brouillon.
    const contexte = await finDeConversation($)
    const prompt = contexte
      ? `Fin de la conversation en cours :\n<conversation>\n${contexte}\n</conversation>\n${brouillon}En tenant compte de cette conversation, ${REGLES_MIEUX}`
      : brouillon + REGLES_MIEUX
    const r = await $.model.complete({ model: 'haiku', prompt, maxTokens: 2000, timeoutMs: 60000 })
    if (!r.isAnswered) {
      $.ui.toast(`Réécriture impossible (${r.reason})`)
      return
    }
    // Ne pas écraser ce qui a été tapé pendant la réécriture.
    if ((await $.prompt.read()).text !== text) {
      $.ui.toast('Brouillon modifié entre-temps : rien remplacé')
      return
    }
    await $.prompt.fill({ text: r.text.trim(), mode: 'replace' })
    $.ui.toast('Relis puis envoie')
  } finally {
    reecriture = false
  }
}

export const register: Register = on => {
  on('turn.complete', ($, e, next) => {
    envoye = null

    return next(e)
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'retiens', description: 'Retenir une consigne dans la mémoire de Claude (le texte après la commande, sinon ma dernière correction)' })
    await $.command.register({ name: 'vider', description: 'Mettre la mémoire à jour puis vider la conversation' })
    await $.command.register({ name: 'archiver', description: 'Mettre la mémoire à jour, renommer puis archiver la conversation' })

    return next(e)
  })

  // Une commande ne peut pas envoyer de message tant qu'elle tourne (elle attendrait son propre tour) :
  // la consigne part juste après, une fois la commande finie.
  on('command.run', { command: 'retiens' }, async ($, e) => {
    const brouillon = e.args.trim()
    void $.clock.sleep(0).then(() => retiens($, brouillon))

    return {}
  })
  on('command.run', { command: 'vider' }, async $ => {
    void $.clock.sleep(0).then(() => envoyer($, 'vider'))

    return {}
  })
  on('command.run', { command: 'archiver' }, async $ => {
    void $.clock.sleep(0).then(() => envoyer($, 'archiver'))

    return {}
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { Box, Button } = $.ui.resolve(e)
    const ouvert = await read($, deplie)

    const replier = () => update($, deplie, () => false)
    const deplier = async () => {
      const mien = ++jeton
      await update($, deplie, () => true)
      await $.clock.sleep(REPLI_MS)
      if (mien === jeton) {
        await replier()
      }
    }
    // Le brouillon (s'il y en a un) devient la consigne à retenir, puis la case est vidée.
    const retiensBrouillon = async () => {
      await replier()
      const brouillon = (await $.prompt.read()).text.trim()
      await retiens($, brouillon)
      if (brouillon) {
        await $.prompt.fill({ text: '', mode: 'replace' })
      }
    }
    const choisir = (action: Action) => async () => {
      await replier()
      await envoyer($, action)
    }

    return (
      <Box>
        {ouvert ? (
          <Box>
            <Button key="retiens" label="Retiens" dimColor onPress={retiensBrouillon} />
            <Button key="vider" label="Vider" dimColor onPress={choisir('vider')} />
            <Button key="archiver" label="Archiver" dimColor onPress={choisir('archiver')} />          </Box>
        ) : (
          <Box>
            <Button key="mieux" label="Mieux" dimColor onPress={() => mieux($)} />
            <Button key="menu" label="⋯" dimColor onPress={deplier} />
          </Box>
        )}
        {/* Le commutateur et l'appli dessinent aussi dans ce pied. */}
        {await next(e)}
      </Box>
    )
  })
}
