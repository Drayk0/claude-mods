# Mods pour l'appli Claude

Deux mods pour l'onglet Code de l'appli Claude de bureau (Mac ou PC).

- **ranger-conv** : sur la ligne du modèle, sous la saisie.
  - **Mieux** réécrit ton brouillon (fautes, clarté) sans l'envoyer.
  - **⋯** déplie **Retiens** (Claude retient une consigne), **Vider** (vide la conversation) et **Archiver** (renomme puis archive).
  - Aussi en commandes : `/retiens [texte]`, `/vider`, `/archiver`.
- **themes-partout** : 20 fonds animés derrière la conversation, le même pour toutes tes sessions. `/custom-theme` pour choisir, `/custom-theme off` pour enlever, `/fireworks` pour un feu d'artifice.

## Installer

1. Accepte l'invitation au dépôt GitHub (mail ou github.com/notifications).
2. Dans l'appli Claude, onglet Code, ouvre une conversation et colle :

   ```text
   Ajoute le catalogue de plugins GitHub <PROPRIETAIRE>/claude-mods (dépôt privé, je suis connecté à GitHub avec gh), puis installe ranger-conv et themes-partout pour mon utilisateur.
   ```

   Si Claude dit que le dépôt est introuvable : installe GitHub CLI et lance `gh auth login`, puis redemande.
3. Quitte l'appli complètement (⌘Q sur Mac, clic droit sur l'icône > Quitter sur PC) et rouvre-la.
4. Les boutons et les commandes apparaissent après le premier message d'une **nouvelle** conversation.

Si tu as déjà le plugin `theme-examples` d'Anthropic, désinstalle-le (en local et sur claude.ai/plugins) : il prend les mêmes commandes que themes-partout.

## Mettre à jour

```text
Mets à jour le catalogue claude-mods et ses plugins.
```

Puis quitte et rouvre l'appli.
