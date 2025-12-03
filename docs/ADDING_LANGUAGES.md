# Adding New Languages

This guide explains how to add new language support to the Arc Raiders Discord Bot. The bot now features **automatic language detection** - simply add a translation file and it will be automatically integrated!

## 🌍 For Translators

If you want to translate the bot into your language, follow these steps. **No coding knowledge required!**

### Step 1: Create Your Translation File

1.  Navigate to the `src/locales/` folder
2.  Copy `en.json` and rename it using your language's 2-letter ISO code:
    *   French: `fr.json`
    *   German: `de.json`
    *   Portuguese: `pt.json`
    *   Japanese: `ja.json`
    *   etc.

### Step 2: Add Language Metadata

Open your new file and update these required fields at the top:

```json
{
  "_developer_note": "Please refer to ./docs/ADDING_LANGUAGES.md for full instructions...",
  "_language_name": "Français",
  "common": { ... }
}
```

**⚠️ IMPORTANT**: The `_language_name` field is **required** and determines how your language appears in the `/settings` command dropdown!

### Step 3: Translate All Sections

Translate the values (text after the `:`) in each section. **Do not modify the keys!**

> **⚠️ Critical Translation Rules**:
> *   ✅ **DO** translate text values
> *   ❌ **DON'T** change keys (e.g., keep `"error"`, `"ping"`, `"settings"`)
> *   ❌ **DON'T** translate placeholders like `{{latency}}`, `{{status}}`, `{{location}}`
> *   ❌ **DON'T** remove any sections or keys
> *   ✅ **DO** keep the exact same JSON structure

#### Sections You Must Translate

Use `en.json` as your reference. Here's what each section controls:

**A. Command Metadata** (Discord UI - command names/descriptions in autocomplete)
**B. Common Strings** (Error messages and shared text)
**C. Commands** (Bot response messages)
**D. Image Renderer** (Text displayed in generated map images)
**E. Map Rotation** (Embed titles, buttons, location/event names, forecast text)

See `en.json` for the complete structure with all keys.

### Step 4: Submit Your Translation

Once complete, submit your translation file via:
*   **Pull Request** on GitHub
*   **Discord** to the bot maintainers
*   **Email** to the project team

That's it! The bot will automatically detect and use your translation.

---

## 🛠️ For Bot Maintainers

The bot **automatically detects and loads** new language files. Here's what you need to do when a translator submits a new language:

### What Happens Automatically

When a new `.json` file is added to `src/locales/`:

✅ **Automatically loaded** by `i18next` (via dynamic preload)  
✅ **Automatically added** to `/settings` command choices (using `_language_name`)  
✅ **Automatically preloaded** for instant availability  
✅ **Automatically applied** to Discord command localizations

### Integration Steps

#### Step 1: Add Discord Locale Mapping (Required)

Edit `src/utils/localeLoader.ts` and add the language to `LOCALE_MAP`:

```typescript
const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  ru: "ru",
  fr: "fr",      // Add new language here
  de: "de",
  pt: "pt-BR",   // Use Discord's specific locale codes
};
```

**Why?** Discord uses specific locale codes (e.g., `pt-BR` instead of `pt`). This maps your file name to Discord's expected format.

📖 **Reference**: [Discord Locale Codes](https://discord.com/developers/docs/reference#locales)

#### Step 2: Deploy Commands (Required)

Run the deployment script to register the new language with Discord:

```bash
npm run deploy-commands
```

**What this does:**
*   Scans `src/locales/` for all `.json` files
*   Loads `command_metadata` from each file
*   Applies name/description localizations to Discord commands
*   Updates `/settings` choices with all available languages (using `_language_name`)
*   Logs success/errors for each language

#### Step 3: Verify (Recommended)

1.  **Check deployment logs** for:
    ```
    [INFO] Loaded locale file: fr
    [INFO] Successfully registered 3 global commands.
    ```

2.  **Start the bot**:
    ```bash
    npm run dev
    ```

3.  **Test in Discord**:
    *   Type `/settings locale:` and verify the new language appears
    *   Select the new language
    *   Verify bot responses are in the new language
    *   Check that the map embed updates to the new language
    *   Verify generated map images show translated text

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Language doesn't appear in `/settings` | Missing `_language_name` in JSON | Add `"_language_name": "Français"` to the file |
| Commands not localized | Missing `command_metadata` section | Ensure translator included all command metadata |
| Discord API error | Translation too long | Discord limits: 32 chars (names), 100 chars (descriptions) |
| Bot uses English instead | File not loaded by i18next | Check logs for parse errors; verify JSON syntax |
| Locale mapping warning | Missing from `LOCALE_MAP` | Add mapping in `localeLoader.ts` |
| Duplicate command names | Two languages use same command name | Discord requires unique names per locale |

### Advanced: Validation

To validate a translation file before deployment:

```bash
# Check JSON syntax
node -e "JSON.parse(require('fs').readFileSync('src/locales/fr.json', 'utf-8'))"

# Verify all required keys exist (manual check against en.json)
diff <(jq -S 'keys' src/locales/en.json) <(jq -S 'keys' src/locales/fr.json)
```

---

## Summary

**For Translators:**
1.  Copy `en.json` → `[language-code].json`
2.  Add `_language_name` field
3.  Translate all values (keep keys unchanged)
4.  Submit the file

**For Maintainers:**
1.  Add language to `LOCALE_MAP` in `localeLoader.ts`
2.  Run `npm run deploy-commands`
3.  Verify in Discord

The bot handles everything else automatically! 🎉

---

## Technical Details

### File Structure

Every locale file must include:
- `_developer_note`: Documentation reference (not translated)
- `_language_name`: Display name for `/settings` dropdown (**required**)
- `command_metadata`: Discord command localizations
- `common`: Shared strings
- `commands`: Command response messages
- `image_renderer`: Text for generated images
- `map_rotation`: Embed content, buttons, locations, events, forecast

### How It Works

1.  **Loading**: `src/utils/localeLoader.ts` scans `src/locales/` and loads all `.json` files
2.  **i18n**: `src/utils/i18n.ts` preloads all detected languages via `i18next`
3.  **Commands**: `src/commands/settings.ts` dynamically generates choices from loaded locales
4.  **Deployment**: `src/deploy-commands.ts` applies localizations to Discord's API
5.  **Runtime**: Bot fetches server's configured locale from database and uses `getT(locale)` for translations
