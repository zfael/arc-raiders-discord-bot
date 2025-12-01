# Adding New Languages

This bot supports automatic command localization. When you add a new language file, the bot will automatically apply the translations to Discord commands.

## Steps to Add a New Language

### 1. Create a New Locale File

Create a new JSON file in `src/locales/` named with the language code (e.g., `fr.json` for French, `de.json` for German).

```bash
cp src/locales/en.json src/locales/fr.json
```

### 2. Update the Locale Mapping

Edit `src/utils/localeLoader.ts` and add your language to the `LOCALE_MAP`:

```typescript
const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr",      // Add this line
  // ...
};
```

**Discord Locale Codes**: See the [Discord documentation](https://discord.com/developers/docs/reference#locales) for valid locale codes.

### 3. Translate the Locale File

Open your new locale file and translate all strings. The file has the following structure:

#### File Structure Overview

```json
{
    "_developer_note": "Translation instructions for contributors",
    "command_metadata": { /* Discord command localizations */ },
    "common": { /* Shared error messages and UI text */ },
    "commands": { /* Command response strings */ },
    "map_rotation": { /* Map rotation embed content */ }
}
```

#### Required Sections

**A. Developer Note**
```json
{
    "_developer_note": "Translate this to explain the file's purpose in your language"
}
```

**B. Command Metadata** (Used for Discord UI localization)
```json
{
    "command_metadata": {
        "ping": {
            "name": "ping",
            "description": "Répond avec Pong! et affiche la latence du bot"
        },
        "settings": {
            "name": "parametres",
            "description": "Configure les paramètres du bot pour ce serveur.",
            "options": {
                "mobile-friendly": {
                    "name": "vue-mobile",
                    "description": "Activer la vue optimisée pour mobile"
                },
                "locale": {
                    "name": "langue",
                    "description": "Définir la langue du bot sur ce serveur"
                }
            }
        },
        "set-channel": {
            "name": "definir-canal",
            "description": "Définit le canal pour les mises à jour de rotation de carte.",
            "options": {
                "channel": {
                    "name": "canal",
                    "description": "Le canal pour envoyer les mises à jour"
                }
            }
        }
    }
}
```

**C. Common Strings** (Shared across commands)
```json
{
    "common": {
        "error": "Une erreur s'est produite lors de l'exécution de cette commande!",
        "error_saving": "Une erreur s'est produite lors de l'enregistrement de vos paramètres.",
        "only_in_guild": "Cette commande ne peut être utilisée que dans un serveur.",
        "menu_locked": "🚫 Ce menu est actuellement utilisé par un autre utilisateur. Veuillez attendre {{remaining}} secondes.",
        "enabled": "ACTIVÉ",
        "disabled": "DÉSACTIVÉ"
    }
}
```

**D. Commands** (Response messages)
```json
{
    "commands": {
        "ping": {
            "description": "Répond avec Pong! et affiche la latence du bot",
            "pinging": "Ping en cours...",
            "response": "🏓 Pong!\n📡 Latence: {{latency}}ms\n💓 Latence API: {{apiLatency}}ms"
        },
        "settings": {
            "description": "Configure les paramètres du bot pour ce serveur.",
            "mobile_friendly": {
                "name": "vue-mobile",
                "description": "Activer la vue optimisée pour mobile"
            },
            "server_only": "Cette commande ne peut être utilisée que dans un serveur.",
            "updated": "Paramètres mis à jour! Le mode vue mobile est maintenant **{{status}}**.",
            "mobile_friendly_updated": "Le mode vue mobile est maintenant **{{status}}**.",
            "locale_updated": "Langue définie sur **{{locale}}**.",
            "no_changes": "Aucune modification effectuée.",
            "enabled": "ACTIVÉ",
            "disabled": "DÉSACTIVÉ"
        },
        "set_channel": {
            "description": "Définit le canal pour les mises à jour de rotation de carte.",
            "channel_option": {
                "name": "canal",
                "description": "Le canal pour envoyer les mises à jour"
            },
            "success": "Les mises à jour de rotation de carte seront maintenant envoyées à {{channel}}.\n\n**Note:** La vue par défaut est optimisée pour **Bureau**. Si vos utilisateurs sont principalement sur mobile, utilisez `/settings mobile-friendly: True`."
        }
    }
}
```

**E. Image Renderer** (Text displayed in generated images)
```json
{
    "image_renderer": {
        "forecast_header": "Prévisions (6 Prochaines Heures)"
    }
}
```

**F. Map Rotation** (Embed content and button labels)
```json
{
    "map_rotation": {
        "title": "Arc Raiders - État de Rotation de Carte",
        "footer": "Bot Arc Raiders • Mises à jour toutes les heures",
        "locked": "🚫 Ce menu est actuellement utilisé par un autre utilisateur. Veuillez attendre {{remaining}} secondes.",
        "buttons": {
            "dam": "Barrage",
            "buried_city": "Ville Enterrée",
            "spaceport": "Port Spatial",
            "blue_gate": "Porte Bleue",
            "stella_montis": "Stella Montis",
            "show_major": "Afficher Événements Majeurs",
            "show_minor": "Afficher Événements Mineurs",
            "show_map": "Afficher Carte",
            "home": "Accueil"
        },
        "events": {
            "harvester": "Moissonneuse",
            "night": "Nuit",
            "storm": "Tempête",
            "tower": "Tour",
            "bunker": "Bunker",
            "matriarch": "Matriarche",
            "husks": "Coques",
            "blooms": "Fleurs",
            "caches": "Caches",
            "probes": "Sondes",
            "none": "Aucun",
            "major": "Majeur",
            "minor": "Mineur"
        },
        "forecast": {
            "header": "━━━━━━ 🔮 PRÉVISIONS (6 Prochaines Heures) ━━━━━━",
            "title_location": "**Prévisions pour {{location}}**",
            "title_event": "**Prévisions pour {{emoji}} {{event}}**",
            "next_rotation": "Prochaine Rotation: <t:{{timestamp}}:R>",
            "no_events": "Aucun événement à venir dans les 24 prochaines heures.",
            "no_major_events": "Aucun Événement Majeur",
            "time_until": "Temps Restant",
            "conditions": "Conditions",
            "locations": "Emplacements",
            "upcoming": "À Venir",
            "in_hours": "dans {{hours}}h"
        },
        "locations": {
            "dam": "Barrage",
            "buried_city": "Ville Enterrée",
            "spaceport": "Port Spatial",
            "blue_gate": "Porte Bleue",
            "stella_montis": "Stella Montis"
        }
    }
}
```

> **💡 Tip**: Use `src/locales/en.json` as your reference. Copy it and translate each value while keeping all keys in English.

> **⚠️ Important**: 
> - Keep all JSON keys in English (e.g., `"error"`, `"commands"`, `"map_rotation"`)
> - Only translate the values (the text after the `:`)
> - Preserve all placeholders like `{{latency}}`, `{{status}}`, `{{location}}`
> - Maintain the exact same structure as `en.json`

### 4. Redeploy Commands

After adding the new locale file, redeploy the commands to Discord:

```bash
npm run deploy-commands
```

The bot will automatically:
- Detect the new locale file
- Load the `command_metadata`
- Apply the localizations to all commands
- Log any errors if Discord rejects a translation

### 5. Add Language Choice to Settings

Edit `src/commands/settings.ts` and add your language to the choices:

```typescript
.addChoices(
  { name: "English", value: "en" },
  { name: "Español", value: "es" },
  { name: "Français", value: "fr" },  // Add this
)
```

## Important Notes

### Command Metadata Structure

The `command_metadata` section must match the structure of your commands:

- **Command names and descriptions** go at the top level
- **Option names and descriptions** go under `options`

Example:
```json
"command_metadata": {
    "command-name": {
        "name": "translated-command-name",
        "description": "Translated description",
        "options": {
            "option-name": {
                "name": "translated-option-name",
                "description": "Translated option description"
            }
        }
    }
}
```

### Logging

The bot logs all localization activities:

- ✅ `Loaded locale file: fr` - Successfully loaded
- ⚠️ `No Discord locale mapping found for: xyz` - Missing mapping in `LOCALE_MAP`
- ⚠️ `No command_metadata found for command "ping" in locale "fr"` - Missing metadata
- ❌ `Failed to load locale file: fr.json` - JSON parse error

Check the logs when deploying commands to ensure all translations were applied correctly.

### Discord API Limitations

Discord may reject certain translations if they:
- Exceed character limits (32 chars for names, 100 for descriptions)
- Contain invalid characters
- Are duplicates of existing command names

The bot will log these errors but continue deploying other localizations.

## Testing

After deploying:

1. Change your Discord language to the new locale in User Settings
2. Type `/` in a channel - you should see translated command names and descriptions
3. Use `/settings locale: [YourLanguage]` to set the server language
4. Verify bot responses are in the correct language
