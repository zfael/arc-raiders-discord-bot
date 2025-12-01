# Adding New Languages

This guide explains how to add new language support to the Arc Raiders Discord Bot.

## 🌍 For Translators

If you want to translate the bot into your language, follow these steps. You do not need any coding knowledge!

### 1. Create a New Locale File

1.  Find the `src/locales/` folder.
2.  Copy `en.json` (the English source) and rename it to your language code (e.g., `fr.json` for French, `de.json` for German).
    *   *Tip*: Use the standard 2-letter ISO code for your language.

### 2. Translate the File

Open your new JSON file and translate the text values.

> **⚠️ Important Rules**:
> *   **Do NOT change the keys** (the text before the `:`). Only translate the values (the text after the `:`).
> *   **Do NOT remove any keys**.
> *   **Do NOT translate placeholders** like `{{latency}}`, `{{status}}`, `{{location}}`. Keep them exactly as they are.
> *   **Structure matters**: Keep the nesting exactly the same as the original file.

#### File Structure Reference

**A. Command Metadata** (Used for Discord's UI - command names and descriptions)
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

**B. Common Strings** (Shared messages)
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

**C. Commands** (Bot responses)
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

**D. Image Renderer** (Text inside generated images)
```json
{
    "image_renderer": {
        "forecast_header": "Prévisions (6 Prochaines Heures)"
    }
}
```

**E. Map Rotation** (Embeds and buttons)
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

---

## 🛠️ For Bot Maintainers

Once a translator has provided a new JSON file, follow these steps to integrate it.

### 1. Update Locale Mapping

Edit `src/utils/localeLoader.ts` and add the new language to the `LOCALE_MAP`:

```typescript
const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr",      // Add the new mapping here
  // ...
};
```
*Refer to [Discord's Locale Codes](https://discord.com/developers/docs/reference#locales) for the correct value.*

### 2. Add Language Choice to Settings

Edit `src/commands/settings.ts` to allow users to select this new language:

```typescript
.addChoices(
  { name: "English", value: "en" },
  { name: "Español", value: "es" },
  { name: "Français", value: "fr" },  // Add the new choice here
)
```

### 3. Redeploy Commands

Run the deployment script to register the new localized command names and descriptions with Discord:

```bash
npm run deploy-commands
```

The bot will automatically:
*   Detect the new locale file.
*   Load the `command_metadata`.
*   Apply localizations to Discord commands.
*   Log any errors or warnings.

### Troubleshooting

*   **Missing Metadata**: If logs show warnings about missing metadata, ensure the translator included the `command_metadata` section.
*   **Discord API Errors**: Discord has strict limits (e.g., 32 chars for names). If a translation is too long, the API will reject it. Check the logs for details.

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
