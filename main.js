'use strict';

const { Plugin, PluginSettingTab, Setting, MarkdownView, Notice, SuggestModal, Modal } = require('obsidian');

// ── Settings ──────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  templatesFolder: 'Templates',
};

// ── UI Helpers (replaces ntb.suggester / ntb.prompt) ─────────

function suggest(app, displayOptions, returnValues, placeholder) {
  return new Promise((resolve) => {
    let chosen = false;

    class Picker extends SuggestModal {
      getSuggestions(query) {
        return displayOptions.filter(o =>
          o.toLowerCase().includes(query.toLowerCase())
        );
      }
      renderSuggestion(item, el) {
        el.createEl('div', { text: item });
      }
      onChooseSuggestion(item) {
        chosen = true;
        resolve(returnValues[displayOptions.indexOf(item)]);
      }
      onClose() {
        if (!chosen) resolve(undefined);
      }
    }

    const modal = new Picker(app);
    if (placeholder) modal.setPlaceholder(placeholder);
    modal.open();
  });
}

function prompt(app, placeholder) {
  return new Promise((resolve) => {
    let resolved = false;

    class Prompter extends Modal {
      onOpen() {
        const { contentEl } = this;
        contentEl.createEl('p', { text: placeholder });
        const input = contentEl.createEl('input', { type: 'text' });
        input.style.width = '100%';
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            resolved = true;
            resolve(input.value);
            this.close();
          }
        });
        input.focus();
      }
      onClose() {
        if (!resolved) resolve(null);
        this.contentEl.empty();
      }
    }

    new Prompter(app).open();
  });
}

// ── Shared Utilities ──────────────────────────────────────────

function normalizeTags(cache) {
  // TODO: port tag normalization from oracle-draw.js
  // Handles inline tags, frontmatter string tags, frontmatter array tags
  // Returns a flat array of '#tag' strings
}

function isTemplatesFile(file, templatesFolder) {
  return file.path.includes(templatesFolder + '/') ||
         file.path.includes(templatesFolder + '\\');
}

function discoverNextLevel(allFiles, basePath, templatesFolder) {
  // TODO: port discoverNextLevel from oracle-draw.js
  // Returns sorted array of next-level segment strings
}

function hasExactLevelNotes(allFiles, targetPath, templatesFolder) {
  // TODO: port hasExactLevelNotes from oracle-draw.js
  // Returns boolean
}

function weightedRandom(files, app) {
  // TODO: port weighted pool logic from oracle-draw.js
  // Returns one randomly selected file, respecting frontmatter weight
}

function insertToPlayLog(view, output) {
  // TODO: port play log insertion from oracle-draw.js
  // Finds '## Play log' section, inserts output before next heading/separator
  // Falls back to end of document
}

// ── Unified Cascade Resolver ──────────────────────────────────

async function resolveCascades(app, text, allFiles, templatesFolder, cascadeChain = [], visited = new Set()) {
  // TODO: port and unify cascade logic from both files
  //
  // 1. Detect all {reference} patterns in text
  // 2. For each unique reference, try in order:
  //    a. Oracle category: find files tagged #oracle/<reference> (excluding #oracle/table)
  //    b. Table file: find file with basename === reference, tagged #oracle/table
  //    c. Neither found: offer manual entry only
  // 3. Prompt user: Roll / Enter Manually (batch if multiple)
  // 4. Recursively resolve cascades in results
  // 5. Substitute all {reference} tokens, return resolved text + cascadeChain
}

// ── Plugin ────────────────────────────────────────────────────

class SoloRPGEngine extends Plugin {
  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'oracle-draw',
      name: 'Oracle: Draw',
      callback: () => this.oracleDraw(),
    });

    this.addCommand({
      id: 'table-roll',
      name: 'Oracle: Roll Table',
      callback: () => this.tableRoll(),
    });

    this.addSettingTab(new SoloRPGSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async oracleDraw() {
    // TODO: port oracle-draw.js main flow
    // Uses: suggest, normalizeTags, discoverNextLevel, hasExactLevelNotes,
    //       weightedRandom, resolveCascades, insertToPlayLog
    // this.app replaces ntb.app
    // MarkdownView replaces ntb.o.MarkdownView
  }

  async tableRoll() {
    // TODO: port table-oracle.js main flow
    // Uses: suggest, normalizeTags, discoverNextLevel, hasExactLevelNotes,
    //       weightedRandom, resolveCascades, insertToPlayLog
    // this.app replaces ntb.app
    // MarkdownView replaces ntb.o.MarkdownView
  }
}

// ── Settings Tab ──────────────────────────────────────────────

class SoloRPGSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Templates folder')
      .setDesc('Files in this folder are excluded from oracle results.')
      .addText(text => text
        .setPlaceholder('Templates')
        .setValue(this.plugin.settings.templatesFolder)
        .onChange(async (value) => {
          this.plugin.settings.templatesFolder = value;
          await this.plugin.saveSettings();
        })
      );
  }
}

module.exports = SoloRPGEngine;
