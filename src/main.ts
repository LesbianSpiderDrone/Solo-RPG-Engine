import {
	App,
	CachedMetadata,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	SuggestModal,
	TFile,
} from 'obsidian';

// ── Settings ──────────────────────────────────────────────────

interface SoloRPGSettings {
	templatesFolder: string;
}

const DEFAULT_SETTINGS: SoloRPGSettings = {
	templatesFolder: 'Templates',
};

// ── Types ─────────────────────────────────────────────────────

interface CascadeEntry {
	category: string;
	result: string;
	method: 'rolled' | 'manual' | 'error';
	details: unknown;
}

// ── UI Helpers (replaces ntb.suggester / ntb.prompt) ─────────

function suggest<T>(
	app: App,
	displayOptions: string[],
	returnValues: T[],
	placeholder?: string
): Promise<T | undefined> {
	return new Promise((resolve) => {
		let chosen = false;

		class Picker extends SuggestModal<string> {
			getSuggestions(query: string): string[] {
				return displayOptions.filter(o =>
					o.toLowerCase().includes(query.toLowerCase())
				);
			}
			renderSuggestion(item: string, el: HTMLElement): void {
				el.createEl('div', { text: item });
			}
			onChooseSuggestion(item: string): void {
				chosen = true;
				resolve(returnValues[displayOptions.indexOf(item)]);
			}
			onClose(): void {
				if (!chosen) resolve(undefined);
			}
		}

		const modal = new Picker(app);
		if (placeholder) modal.setPlaceholder(placeholder);
		modal.open();
	});
}

function prompt(app: App, placeholder: string): Promise<string | null> {
	return new Promise((resolve) => {
		let resolved = false;

		class Prompter extends Modal {
			onOpen(): void {
				const { contentEl } = this;
				contentEl.createEl('p', { text: placeholder });
				const input = contentEl.createEl('input', { type: 'text' });
				input.style.width = '100%';
				input.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter') {
						resolved = true;
						resolve(input.value);
						this.close();
					}
				});
				input.focus();
			}
			onClose(): void {
				if (!resolved) resolve(null);
				this.contentEl.empty();
			}
		}

		new Prompter(app).open();
	});
}

// ── Shared Utilities ──────────────────────────────────────────

function normalizeTags(cache: CachedMetadata | null): string[] {
	// TODO: port tag normalization from oracle-draw.js
	// Handles inline tags, frontmatter string tags, frontmatter array tags
	// Returns a flat array of '#tag' strings
	return [];
}

function isTemplatesFile(file: TFile, templatesFolder: string): boolean {
	return file.path.includes(templatesFolder + '/') ||
		file.path.includes(templatesFolder + '\\');
}

function discoverNextLevel(
	allFiles: TFile[],
	basePath: string,
	templatesFolder: string,
	app: App
): string[] {
	// TODO: port discoverNextLevel from oracle-draw.js
	// Returns sorted array of next-level segment strings
	return [];
}

function hasExactLevelNotes(
	allFiles: TFile[],
	targetPath: string,
	templatesFolder: string,
	app: App
): boolean {
	// TODO: port hasExactLevelNotes from oracle-draw.js
	return false;
}

function weightedRandom(files: TFile[], app: App): TFile | null {
	// TODO: port weighted pool logic from oracle-draw.js
	// Returns one randomly selected file, respecting frontmatter weight
	return null;
}

function insertToPlayLog(view: MarkdownView, output: string): void {
	// TODO: port play log insertion from oracle-draw.js
	// Finds '## Play log' section, inserts output before next heading/separator
	// Falls back to end of document
}

// ── Unified Cascade Resolver ──────────────────────────────────

async function resolveCascades(
	app: App,
	text: string,
	allFiles: TFile[],
	templatesFolder: string,
	cascadeChain: CascadeEntry[] = [],
	visited: Set<string> = new Set()
): Promise<{ resolvedText: string; cascadeChain: CascadeEntry[] } | null> {
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
	return { resolvedText: text, cascadeChain };
}

// ── Plugin ────────────────────────────────────────────────────

export default class SoloRPGEngine extends Plugin {
	settings!: SoloRPGSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: 'oracle-draw',
			name: 'Oracle: Draw',
			callback: () => { void this.oracleDraw(); },
		});

		this.addCommand({
			id: 'table-roll',
			name: 'Oracle: Roll Table',
			callback: () => { void this.tableRoll(); },
		});

		this.addSettingTab(new SoloRPGSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData() as Partial<SoloRPGSettings>
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async oracleDraw(): Promise<void> {
		// TODO: port oracle-draw.js main flow
		// Uses: suggest, normalizeTags, discoverNextLevel, hasExactLevelNotes,
		//       weightedRandom, resolveCascades, insertToPlayLog
	}

	async tableRoll(): Promise<void> {
		// TODO: port table-oracle.js main flow
		// Uses: suggest, normalizeTags, discoverNextLevel, hasExactLevelNotes,
		//       weightedRandom, resolveCascades, insertToPlayLog
	}
}

// ── Settings Tab ──────────────────────────────────────────────

class SoloRPGSettingTab extends PluginSettingTab {
	plugin: SoloRPGEngine;

	constructor(app: App, plugin: SoloRPGEngine) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Templates folder')
			.setDesc('Files in this folder are excluded from oracle results.')
			.addText(text => text
				.setPlaceholder('Templates')
				.setValue(this.plugin.settings.templatesFolder)
				.onChange(async (value: string) => {
					this.plugin.settings.templatesFolder = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
