/*  table-oracle-cascade.js — UNIVERSAL CASCADE VERSION
    Multi-column table oracle with automatic dependency resolution
    
    NEW FEATURES:
    - Detects {Filename} syntax in table results
    - Dynamically finds and rolls referenced tables
    - User control: Roll Table / Enter Manually for each dependency
    - Batch options: Roll All / Enter All when multiple dependencies
    - Recursive cascade resolution with cycle detection
    - Works with any future table - completely extensible
    - Graceful handling of missing tables
    - Backwards compatible (tables without cascades work as before)
    
    SYNTAX:
    Use {Filename} in table cells to reference other tables:
    - {Divine_s_Name} → finds and rolls Divine_s_Name.md
    - {Divine_s_Portfolio} → finds and rolls Divine_s_Portfolio.md
    
    Called by Note Toolbar "Execute JavaScript file" item
*/

try {
  const allFiles = ntb.app.vault.getMarkdownFiles();
  
  // Icon map
  const icons = {
    religion: '⛪', combat: '⚔️', location: '🏰',
    character: '👤', event: '📅', faction: '🏴',
    treasure: '💎', magic: '✨', social: '🗣️'
  };

  // ========== NAVIGATION (unchanged from original) ==========
  let currentPath = '#oracle/table';
  let displayPath = [];
  let includeDescendants = true;
  
  const discoverNextLevel = (basePath) => {
    const nextLevelSet = new Set();
    
    for (const file of allFiles) {
      try {
        if (file.path.includes('Templates/')) continue;
        
        const cache = ntb.app.metadataCache.getFileCache(file);
        if (!cache) continue;
        
        const inlineTags = (cache.tags || []).map(t => t.tag);
        const fmRaw = cache.frontmatter?.tags;
        let fmTags = [];
        
        if (Array.isArray(fmRaw)) {
          fmTags = fmRaw.map(t => 
            (t && typeof t === 'string') ? 
            (t.startsWith('#') ? t : '#' + t) : ''
          ).filter(Boolean);
        } else if (typeof fmRaw === 'string' && fmRaw) {
          fmTags = [fmRaw.startsWith('#') ? fmRaw : '#' + fmRaw];
        }
        
        const allTags = [...(inlineTags || []), ...(fmTags || [])];
        
        for (const tag of allTags) {
          if (!tag || typeof tag !== 'string') continue;
          
          if (tag.startsWith(basePath + '/')) {
            const remainder = tag.substring(basePath.length + 1);
            const nextSegment = remainder.split('/')[0];
            if (nextSegment) nextLevelSet.add(nextSegment);
          }
        }
      } catch (err) {
        console.error(`Error discovering level in ${file.path}:`, err);
        continue;
      }
    }
    
    return [...nextLevelSet].sort();
  };
  
  const hasExactLevelNotes = (targetPath) => {
    return allFiles.some(file => {
      try {
        if (file.path.includes('Templates/')) return false;
        
        const cache = ntb.app.metadataCache.getFileCache(file);
        if (!cache) return false;
        
        const inlineTags = (cache.tags || []).map(t => t.tag);
        const fmRaw = cache.frontmatter?.tags;
        let fmTags = [];
        
        if (Array.isArray(fmRaw)) {
          fmTags = fmRaw.map(t => 
            (t && typeof t === 'string') ? 
            (t.startsWith('#') ? t : '#' + t) : ''
          ).filter(Boolean);
        } else if (typeof fmRaw === 'string' && fmRaw) {
          fmTags = [fmRaw.startsWith('#') ? fmRaw : '#' + fmRaw];
        }
        
        const allTags = [...(inlineTags || []), ...(fmTags || [])];
        return allTags.some(t => t === targetPath);
      } catch (err) {
        return false;
      }
    });
  };
  
  // Navigate hierarchy
  while (true) {
    const nextLevel = discoverNextLevel(currentPath);
    
    if (nextLevel.length === 0) break;
    
    const isTopLevel = currentPath === '#oracle/table';
    const displayNames = isTopLevel 
      ? nextLevel.map(c => `${icons[c] || '📊'} ${c.charAt(0).toUpperCase() + c.slice(1)}`)
      : nextLevel.map(c => c.charAt(0).toUpperCase() + c.slice(1));
    
    let options, values;
    
    if (isTopLevel) {
      options = displayNames;
      values = nextLevel;
    } else {
      options = [`🎲 Random (all ${displayPath.join('/')})`];
      values = ['ALL_BELOW'];
      
      if (hasExactLevelNotes(currentPath)) {
        options.push(`🎯 This level only`);
        values.push('EXACT');
      }
      
      options.push(...displayNames);
      values.push(...nextLevel);
    }
    
    const placeholder = isTopLevel 
      ? '📊 Pick a table category…'
      : `Pick ${displayPath.join('/')} subcategory…`;
    
    const picked = await ntb.suggester(options, values, { placeholder });
    
    if (picked === undefined) return;
    
    if (picked === 'ALL_BELOW') {
      includeDescendants = true;
      break;
    }
    
    if (picked === 'EXACT') {
      includeDescendants = false;
      break;
    }
    
    currentPath += '/' + picked;
    displayPath.push(picked);
  }
  
  const targetTag = currentPath;
  const topCategory = displayPath[0] || 'table';

  // Find matching tables
  const matches = allFiles.filter(file => {
    try {
      if (file.path.includes('Templates/')) return false;
      
      const cache = ntb.app.metadataCache.getFileCache(file);
      if (!cache) return false;
      
      const inlineTags = (cache.tags || []).map(t => t.tag);
      const fmRaw = cache.frontmatter?.tags;
      let fmTags = [];
      
      if (Array.isArray(fmRaw)) {
        fmTags = fmRaw.map(t => 
          (t && typeof t === 'string') ? 
          (t.startsWith('#') ? t : '#' + t) : ''
        ).filter(Boolean);
      } else if (typeof fmRaw === 'string' && fmRaw) {
        fmTags = [fmRaw.startsWith('#') ? fmRaw : '#' + fmRaw];
      }
      
      const allTags = [...(inlineTags || []), ...(fmTags || [])];
      
      if (includeDescendants) {
        return allTags.some(t => t === targetTag || t.startsWith(targetTag + '/'));
      } else {
        return allTags.some(t => t === targetTag);
      }
    } catch (err) {
      return false;
    }
  });

  if (matches.length === 0) {
    new Notice(`❌ No tables found for ${targetTag}`, 5000);
    return;
  }

  // Select table
  const displayNames = matches.map(file => {
    const cache = ntb.app.metadataCache.getFileCache(file);
    const icon = cache?.frontmatter?.icon || '📊';
    return `${icon} ${file.basename}`;
  });
  
  const picked = await ntb.suggester(displayNames, matches, {
    placeholder: `Pick a table (${matches.length} available)…`
  });

  if (!picked) return;

  // ========== CASCADE SYSTEM (NEW) ==========
  
  // Helper: Find table file by basename
  const findTableByName = (tableName) => {
    return allFiles.find(f => f.basename === tableName);
  };
  
  // Helper: Roll a table and return results + metadata
  const rollTable = async (file, cascadeChain = [], visitedTables = new Set()) => {
    // Cycle detection
    if (visitedTables.has(file.basename)) {
      return {
        error: `Circular reference detected: ${file.basename}`,
        result: null
      };
    }
    
    const newVisited = new Set(visitedTables);
    newVisited.add(file.basename);
    
    const content = await ntb.app.vault.read(file);
    const cache = ntb.app.metadataCache.getFileCache(file);
    
    const separator = cache?.frontmatter?.separator ?? '';
    const columnLabels = cache?.frontmatter?.columns || null;
    const allowBlanks = cache?.frontmatter?.allow_blanks ?? true;
    const dieHint = cache?.frontmatter?.die || null;
    const diceHint = cache?.frontmatter?.dice || null;
    
    // Parse table
    const lines = content.split('\n');
    let tableStart = -1;
    let tableHeader = null;
    let tableSeparator = -1;
    const tableRows = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line.startsWith('|')) continue;
      
      if (tableStart === -1) {
        tableStart = i;
        tableHeader = line;
        continue;
      }
      
      if (tableSeparator === -1 && line.match(/^\|[\s\-:|]+\|$/)) {
        tableSeparator = i;
        continue;
      }
      
      if (tableSeparator !== -1) {
        if (!line.startsWith('|')) break;
        tableRows.push(line);
      }
    }

    if (!tableHeader || tableRows.length === 0) {
      return {
        error: `No valid table found in ${file.basename}`,
        result: null
      };
    }

    const parseRow = (row) => {
      return row.split('|')
        .map(cell => cell.trim())
        .filter((cell, idx, arr) => {
          if (idx === 0 || idx === arr.length - 1) return cell !== '';
          return true;
        });
    };

    const headerCells = parseRow(tableHeader);
    const dataRows = tableRows.map(parseRow);

    // Determine dice per column
    const dataColumnIndexes = [];
    for (let i = 1; i < headerCells.length; i++) {
      dataColumnIndexes.push(i);
    }

    if (dataColumnIndexes.length === 0) {
      return {
        error: `No data columns in ${file.basename}`,
        result: null
      };
    }

    // Detect die sizes per column
    const columnDice = [];
    
    if (diceHint && Array.isArray(diceHint)) {
      // Use manual override
      for (let i = 0; i < dataColumnIndexes.length; i++) {
        const dieStr = diceHint[i];
        const match = dieStr.match(/d(\d+)/i);
        columnDice.push(match ? parseInt(match[1]) : null);
      }
    } else {
      // Auto-detect
      for (let colIdx of dataColumnIndexes) {
        let maxRow = 0;
        for (const row of dataRows) {
          const rowNum = parseInt(row[0]);
          if (!isNaN(rowNum) && row[colIdx] && row[colIdx].trim() !== '') {
            maxRow = Math.max(maxRow, rowNum);
          }
        }
        columnDice.push(maxRow > 0 ? maxRow : 1);
      }
    }

    // Roll each column
    const results = [];
    const rollDetails = [];

    for (let i = 0; i < dataColumnIndexes.length; i++) {
      const actualColIdx = dataColumnIndexes[i];
      const dieSize = columnDice[i];
      
      if (!dieSize) continue;
      
      const roll = Math.floor(Math.random() * dieSize) + 1;
      
      let resultValue = null;
      for (const row of dataRows) {
        const rowNumber = parseInt(row[0]);
        if (rowNumber === roll) {
          resultValue = row[actualColIdx];
          break;
        }
      }

      if (!resultValue || resultValue.trim() === '') {
        if (!allowBlanks) {
          return {
            error: `Rolled ${roll} on ${file.basename} but cell is empty`,
            result: null
          };
        }
        continue;
      }

      const label = columnLabels && columnLabels[i] 
        ? columnLabels[i] 
        : null;
      
      results.push(resultValue.trim());
      rollDetails.push({
        column: label || `Col ${i + 1}`,
        roll: roll,
        die: dieSize,
        value: resultValue.trim()
      });
    }

    if (results.length === 0) {
      return {
        error: `All cells blank in ${file.basename}`,
        result: null
      };
    }

    // Combine results
    const combined = results.join(separator);
    
    return {
      error: null,
      result: combined,
      rollDetails: rollDetails,
      tableName: file.basename
    };
  };
  
  // Helper: Detect cascade references in text
  const detectCascades = (text) => {
    const regex = /{([^}]+)}/g;
    const matches = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        fullMatch: match[0],
        tableName: match[1],
        index: match.index
      });
    }
    
    return matches;
  };
  
  // Helper: Resolve cascades with user control
  const resolveCascades = async (text, cascadeChain = [], visitedTables = new Set()) => {
    const cascades = detectCascades(text);
    
    if (cascades.length === 0) {
      return {
        resolvedText: text,
        cascadeChain: cascadeChain
      };
    }
    
    // Deduplicate cascade references (same table referenced multiple times)
    const uniqueCascades = [];
    const seenTables = new Set();
    
    for (const cascade of cascades) {
      if (!seenTables.has(cascade.tableName)) {
        uniqueCascades.push(cascade);
        seenTables.add(cascade.tableName);
      }
    }
    
    // Batch prompt if multiple dependencies
    let batchChoice = null;
    if (uniqueCascades.length > 1) {
      batchChoice = await ntb.suggester(
        [
          `🎲 Roll All (${uniqueCascades.length} dependencies)`,
          `✍️ Enter All Manually`,
          `⚙️ Choose Individually`
        ],
        ['roll_all', 'enter_all', 'individual'],
        { placeholder: `${uniqueCascades.length} dependencies detected` }
      );
      
      if (batchChoice === undefined) return null; // User cancelled
    }
    
    // Resolution cache for this roll
    const resolutionCache = new Map();
    
    // Resolve each unique cascade
    for (const cascade of uniqueCascades) {
      const tableName = cascade.tableName;
      const tableFile = findTableByName(tableName);
      
      let resolvedValue = null;
      let resolutionMethod = null;
      let resolutionDetails = null;
      
      // Determine resolution method
      let method;
      if (batchChoice === 'roll_all') {
        method = 'roll';
      } else if (batchChoice === 'enter_all') {
        method = 'manual';
      } else {
        // Individual choice or single dependency
        if (!tableFile) {
          // Table doesn't exist - can only enter manually
          method = await ntb.suggester(
            [`⚠️ Table "${tableName}" not found - Enter Manually`],
            ['manual'],
            { placeholder: `Dependency: ${tableName}` }
          );
        } else {
          method = await ntb.suggester(
            [`🎲 Roll ${tableName}`, `✍️ Enter Manually`],
            ['roll', 'manual'],
            { placeholder: `Dependency: ${tableName}` }
          );
        }
        
        if (method === undefined) return null; // User cancelled
      }
      
      // Execute resolution
      if (method === 'manual') {
        // Manual entry via prompt
        const userInput = await ntb.prompt(`Enter value for ${tableName}:`);
        
        if (userInput === null || userInput === undefined) return null; // User cancelled
        
        resolvedValue = userInput;
        resolutionMethod = 'manual';
      } else {
        // Roll the table
        if (!tableFile) {
          new Notice(`⚠️ Table "${tableName}" not found`, 5000);
          resolvedValue = `{${tableName}}`;
          resolutionMethod = 'not_found';
        } else {
          const rollResult = await rollTable(tableFile, cascadeChain, visitedTables);
          
          if (rollResult.error) {
            new Notice(`⚠️ ${rollResult.error}`, 5000);
            resolvedValue = `{${tableName}}`;
            resolutionMethod = 'error';
          } else {
            resolvedValue = rollResult.result;
            resolutionMethod = 'rolled';
            resolutionDetails = rollResult.rollDetails;
            
            // Add to cascade chain
            cascadeChain.push({
              tableName: tableName,
              result: resolvedValue,
              details: resolutionDetails,
              method: 'rolled'
            });
            
            // Recursively resolve if the result has cascades
            const recursive = await resolveCascades(
              resolvedValue, 
              cascadeChain, 
              visitedTables
            );
            
            if (recursive === null) return null; // User cancelled
            
            resolvedValue = recursive.resolvedText;
          }
        }
      }
      
      // Add manual entries to cascade chain
      if (resolutionMethod === 'manual') {
        cascadeChain.push({
          tableName: tableName,
          result: resolvedValue,
          details: null,
          method: 'manual'
        });
      }
      
      // Cache resolution
      resolutionCache.set(tableName, resolvedValue);
    }
    
    // Substitute all occurrences
    let resolvedText = text;
    for (const [tableName, value] of resolutionCache) {
      const regex = new RegExp(`\\{${tableName}\\}`, 'g');
      resolvedText = resolvedText.replace(regex, value);
    }
    
    return {
      resolvedText: resolvedText,
      cascadeChain: cascadeChain
    };
  };
  
  // ========== ROLL MAIN TABLE ==========
  
  const mainRollResult = await rollTable(picked);
  
  if (mainRollResult.error) {
    new Notice(`❌ ${mainRollResult.error}`, 5000);
    return;
  }
  
  // ========== RESOLVE CASCADES ==========
  
  const cascadeResult = await resolveCascades(mainRollResult.result);
  
  if (cascadeResult === null) {
    // User cancelled during cascade resolution
    return;
  }
  
  const finalResult = cascadeResult.resolvedText;
  const cascadeChain = cascadeResult.cascadeChain;
  
  // ========== INSERT RESULT ==========
  
  const view = ntb.app.workspace.getActiveViewOfType(ntb.o.MarkdownView);
  if (view) {
    const editor = view.editor;
    const cache = ntb.app.metadataCache.getFileCache(picked);
    const icon = cache?.frontmatter?.icon || '📊';
    const tableName = picked.basename;
    const columnLabels = cache?.frontmatter?.columns || null;
    
    let output;
    
    // Build main result line
    if (columnLabels && columnLabels.length > 0) {
      const labeled = mainRollResult.rollDetails
        .map(d => `${d.column}: ${d.value}`)
        .join(', ');
      output = `> ${icon} **${tableName}:** ${labeled}\n`;
    } else {
      output = `> ${icon} **${tableName}:** ${finalResult}\n`;
    }
    
    // Add cascade chain
    if (cascadeChain.length > 0) {
      for (const entry of cascadeChain) {
        if (entry.method === 'rolled' && entry.details) {
          const detailStr = entry.details
            .map(d => `${d.value}[${d.roll}/${d.die}]`)
            .join('·');
          output += `>   ↳ ${entry.tableName}: ${detailStr}\n`;
        } else if (entry.method === 'manual') {
          output += `>   ↳ ${entry.tableName}: ${entry.result} (manual)\n`;
        }
      }
    }
    
    output += '\n';
    
    // Insert at Play log section
    const content = editor.getValue();
    const lines = content.split('\n');
    let playLogStart = -1;
    let insertPoint = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '## Play log') {
        playLogStart = i;
        break;
      }
    }
    
    if (playLogStart === -1) {
      const lastLine = editor.lastLine();
      const lastLineLength = editor.getLine(lastLine).length;
      editor.replaceRange(output, {line: lastLine, ch: lastLineLength});
    } else {
      for (let i = playLogStart + 1; i < lines.length; i++) {
        if (lines[i].trim().startsWith('##') || lines[i].trim() === '---') {
          insertPoint = i;
          break;
        }
      }
      
      if (insertPoint === -1) {
        const lastLine = editor.lastLine();
        const lastLineLength = editor.getLine(lastLine).length;
        editor.replaceRange(output, {line: lastLine, ch: lastLineLength});
      } else {
        const targetLine = insertPoint - 1;
        const targetLength = editor.getLine(targetLine).length;
        editor.replaceRange('\n' + output, {line: targetLine, ch: targetLength});
      }
    }
  }
  
  // ========== SHOW NOTICE ==========
  
  const cache = ntb.app.metadataCache.getFileCache(picked);
  const icon = cache?.frontmatter?.icon || '📊';
  const rollSummary = mainRollResult.rollDetails
    .map(d => `${d.value}[${d.roll}]`)
    .join(' ');
  new Notice(`${icon} ${rollSummary}`, 5000);
  
  // ========== OFFER TO OPEN ==========
  
  const openIt = await ntb.suggester(
    ['View table', 'Continue writing'], 
    [true, false], 
    { placeholder: `Rolled: ${finalResult}` }
  );
  
  if (openIt) {
    await ntb.app.workspace.getLeaf('tab').openFile(picked);
  }

  return `Rolled: ${finalResult}`;

} catch (error) {
  console.error('Table Oracle Cascade Error:', error);
  new Notice(`⚠️ Table oracle error: ${error.message}. Check console.`, 8000);
  return null;
}
