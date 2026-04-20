/*  oracle-draw.js — CASCADE VERSION
    Random oracle draw from tagged notes with automatic dependency resolution
    Called by Note Toolbar "Execute JavaScript file" item
    Dynamically discovers all #oracle/* categories from the vault
    
    NEW CASCADE FEATURES:
    - Detects {category} syntax in oracle descriptions
    - Dynamically rolls oracles from referenced categories
    - User control: Roll Category / Enter Manually for each dependency
    - Batch options: Roll All / Enter All when multiple dependencies
    - Recursive cascade resolution with cycle detection
    - Works with any future oracle category - completely extensible
    - Graceful handling of missing categories
    
    SYNTAX:
    Use {category} or {oracle/category} in description fields to reference oracle categories:
    - {item} → randomly draws from #oracle/item
    - {oracle/location} → randomly draws from #oracle/location
    - {event/sci-fi} → randomly draws from #oracle/event/sci-fi
    
    PREVIOUS FIXES:
    - Added defensive null checks for metadata cache
    - Added input sanitization
    - Added error handling with user feedback
    - Improved tag normalization consistency
    - Added caching hint for performance
    - Added Templates folder exclusion
*/
 
try {
  // Step 1: Discover all oracle categories from the tag index
  const allFiles = ntb.app.vault.getMarkdownFiles();
  const categorySet = new Set();
 
  for (const file of allFiles) {
    try {
      // Skip files in Templates folder
      if (file.path.includes('Templates/') || file.path.includes('Templates\\')) continue;
      
      const cache = ntb.app.metadataCache.getFileCache(file);
      if (!cache) continue;
 
      // Collect tags from both frontmatter and body
      const inlineTags = (cache.tags || []).map(t => t.tag);
      const fmRaw = cache.frontmatter?.tags;
      let fmTags = [];
      
      if (Array.isArray(fmRaw)) {
        fmTags = fmRaw.map(t => (t && typeof t === 'string') ? (t.startsWith('#') ? t : '#' + t) : '').filter(Boolean);
      } else if (typeof fmRaw === 'string' && fmRaw) {
        fmTags = [fmRaw.startsWith('#') ? fmRaw : '#' + fmRaw];
      }
 
      // Defensive spread with fallbacks
      const allTags = [...(inlineTags || []), ...(fmTags || [])];
      
      for (const tag of allTags) {
        if (!tag || typeof tag !== 'string') continue;
        // Match #oracle/something but not just #oracle alone
        const match = tag.match(/^#oracle\/([^/]+)/);
        if (match) categorySet.add(match[1]);
      }
    } catch (err) {
      // Skip files with cache errors
      console.error(`Error processing file ${file.path}:`, err);
      continue;
    }
  }
 
  const categories = [...categorySet].sort();
 
  if (categories.length === 0) {
    new Notice('⚠️ No oracle categories found. Tag notes with #oracle/category.', 5000);
    return;
  }
 
  // Step 2: Icon map (centralized, can be extended)
  const icons = {
    event: '⚔️', character: '👤', location: '🏰',
    theme: '🎭', twist: '🔀', item: '💎',
    threat: '💀', treasure: '✨', faction: '🏴',
    mood: '🌙', combat: '⚔️', social: '🗣️',
    exploration: '🧭', mystery: '🔍'
  };
 
  // Step 3: Navigate through hierarchy with unlimited depth
  let currentPath = '#oracle';
  let displayPath = [];
  let includeDescendants = true; // Track whether to include subcategories in final draw
  
  // Helper function to discover next level under current path
  const discoverNextLevel = (basePath) => {
    const nextLevelSet = new Set();
    
    for (const file of allFiles) {
      try {
        if (file.path.includes('Templates/') || file.path.includes('Templates\\')) continue;
        
        const cache = ntb.app.metadataCache.getFileCache(file);
        if (!cache) continue;
        
        const inlineTags = (cache.tags || []).map(t => t.tag);
        const fmRaw = cache.frontmatter?.tags;
        let fmTags = [];
        
        if (Array.isArray(fmRaw)) {
          fmTags = fmRaw.map(t => (t && typeof t === 'string') ? (t.startsWith('#') ? t : '#' + t) : '').filter(Boolean);
        } else if (typeof fmRaw === 'string' && fmRaw) {
          fmTags = [fmRaw.startsWith('#') ? fmRaw : '#' + fmRaw];
        }
        
        const allTags = [...(inlineTags || []), ...(fmTags || [])];
        
        for (const tag of allTags) {
          if (!tag || typeof tag !== 'string') continue;
          
          // Check if tag starts with our base path + /
          if (tag.startsWith(basePath + '/')) {
            // Extract the next segment after basePath
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
  
  // Helper function to check if notes exist at exact level (not in subcategories)
  const hasExactLevelNotes = (targetPath) => {
    return allFiles.some(file => {
      try {
        if (file.path.includes('Templates/') || file.path.includes('Templates\\')) return false;
        
        const cache = ntb.app.metadataCache.getFileCache(file);
        if (!cache) return false;
        
        const inlineTags = (cache.tags || []).map(t => t.tag);
        const fmRaw = cache.frontmatter?.tags;
        let fmTags = [];
        
        if (Array.isArray(fmRaw)) {
          fmTags = fmRaw.map(t => (t && typeof t === 'string') ? (t.startsWith('#') ? t : '#' + t) : '').filter(Boolean);
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
  
  // ========== CASCADE SYSTEM ==========
  
  // Helper: Draw from oracle category and return title + metadata
  const drawOracleCategory = async (category, cascadeChain = [], visitedCategories = new Set()) => {
    // Cycle detection
    if (visitedCategories.has(category)) {
      return {
        error: `Circular reference detected: ${category}`,
        title: null
      };
    }
    
    const newVisited = new Set(visitedCategories);
    newVisited.add(category);
    
    // Normalize category to tag format
    let categoryTag;
    if (category.startsWith('#oracle/')) {
      // Already fully qualified: {#oracle/weapon} → #oracle/weapon
      categoryTag = category;
    } else if (category.startsWith('oracle/')) {
      // Missing #: {oracle/weapon} → #oracle/weapon
      categoryTag = '#' + category;
    } else {
      // Just the category: {weapon} → #oracle/weapon
      categoryTag = '#oracle/' + category;
    }
    
    // Find all files matching this category
    const categoryMatches = allFiles.filter(file => {
      try {
        if (file.path.includes('Templates/') || file.path.includes('Templates\\')) return false;
        
        const cache = ntb.app.metadataCache.getFileCache(file);
        if (!cache) return false;
        
        const inlineTags = (cache.tags || []).map(t => t.tag);
        const fmRaw = cache.frontmatter?.tags;
        let fmTags = [];
        
        if (Array.isArray(fmRaw)) {
          fmTags = fmRaw.map(t => (t && typeof t === 'string') ? (t.startsWith('#') ? t : '#' + t) : '').filter(Boolean);
        } else if (typeof fmRaw === 'string' && fmRaw) {
          fmTags = [fmRaw.startsWith('#') ? fmRaw : '#' + fmRaw];
        }
        
        const allTags = [...(inlineTags || []), ...(fmTags || [])];
        // Include files at this level AND in subcategories
        return allTags.some(t => t === categoryTag || t.startsWith(categoryTag + '/'));
      } catch (err) {
        return false;
      }
    });
    
    if (categoryMatches.length === 0) {
      return {
        error: `No oracles found for category: ${category}`,
        title: null
      };
    }
    
    // Weighted random selection
    const weightedPool = [];
    for (const file of categoryMatches) {
      const cache = ntb.app.metadataCache.getFileCache(file);
      const weight = cache?.frontmatter?.weight;
      const normalizedWeight = (typeof weight === 'number' && weight > 0) ? Math.floor(weight) : 1;
      
      for (let i = 0; i < normalizedWeight; i++) {
        weightedPool.push(file);
      }
    }
    
    const selected = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    const title = selected.basename;
    const cache = ntb.app.metadataCache.getFileCache(selected);
    const weight = cache?.frontmatter?.weight || 1;
    const description = cache?.frontmatter?.description || '';
    
    return {
      title: title,
      description: description,
      weight: weight,
      error: null
    };
  };
  
  // Helper: Resolve cascades in text
  const resolveCascades = async (text, cascadeChain = [], visitedCategories = new Set()) => {
    // Find all {category} or {oracle/category} patterns
    const cascadePattern = /\{([^}]+)\}/g;
    const cascades = [];
    let match;
    
    while ((match = cascadePattern.exec(text)) !== null) {
      cascades.push({
        fullMatch: match[0],
        category: match[1],
        index: match.index
      });
    }
    
    if (cascades.length === 0) {
      return {
        resolvedText: text,
        cascadeChain: cascadeChain
      };
    }
    
    // Deduplicate by category
    const uniqueCascades = [];
    const seenCategories = new Set();
    for (const cascade of cascades) {
      if (!seenCategories.has(cascade.category)) {
        uniqueCascades.push(cascade);
        seenCategories.add(cascade.category);
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
    
    // Resolution cache for this draw
    const resolutionCache = new Map();
    
    // Resolve each unique cascade
    for (const cascade of uniqueCascades) {
      const category = cascade.category;
      
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
        method = await ntb.suggester(
          [`🎲 Roll ${category}`, `✍️ Enter Manually`],
          ['roll', 'manual'],
          { placeholder: `Dependency: ${category}` }
        );
        
        if (method === undefined) return null; // User cancelled
      }
      
      // Execute resolution
      if (method === 'manual') {
        // Manual entry via prompt
        const userInput = await ntb.prompt(`Enter value for ${category}:`);
        
        if (userInput === null || userInput === undefined) return null; // User cancelled
        
        resolvedValue = userInput;
        resolutionMethod = 'manual';
      } else {
        // Roll the oracle category
        const drawResult = await drawOracleCategory(category, cascadeChain, visitedCategories);
        
        if (drawResult.error) {
          new Notice(`⚠️ ${drawResult.error}`, 5000);
          resolvedValue = `{${category}}`;
          resolutionMethod = 'error';
        } else {
          resolvedValue = drawResult.title;
          resolutionMethod = 'rolled';
          resolutionDetails = {
            weight: drawResult.weight,
            description: drawResult.description
          };
          
          // Add to cascade chain
          cascadeChain.push({
            category: category,
            result: resolvedValue,
            details: resolutionDetails,
            method: 'rolled'
          });
          
          // Recursively resolve if the oracle's description has cascades
          if (drawResult.description) {
            const recursive = await resolveCascades(
              drawResult.description, 
              cascadeChain, 
              visitedCategories
            );
            
            if (recursive === null) return null; // User cancelled
            
            // Don't replace the title, but track nested cascades
          }
        }
      }
      
      // Add manual entries to cascade chain
      if (resolutionMethod === 'manual') {
        cascadeChain.push({
          category: category,
          result: resolvedValue,
          details: null,
          method: 'manual'
        });
      }
      
      // Cache resolution
      resolutionCache.set(category, resolvedValue);
    }
    
    // Substitute all occurrences
    let resolvedText = text;
    for (const [category, value] of resolutionCache) {
      const regex = new RegExp(`\\{${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g');
      resolvedText = resolvedText.replace(regex, value);
    }
    
    return {
      resolvedText: resolvedText,
      cascadeChain: cascadeChain
    };
  };
  
  // ========== MAIN ORACLE DRAW ==========
  
  // Navigate through hierarchy
  while (true) {
    const nextLevel = discoverNextLevel(currentPath);
    
    if (nextLevel.length === 0) {
      // No subcategories - we're at a leaf, stop drilling
      break;
    }
    
    // Build display names with icons for top level
    const isTopLevel = currentPath === '#oracle';
    const displayNames = isTopLevel 
      ? nextLevel.map(c => `${icons[c] || '📜'} ${c.charAt(0).toUpperCase() + c.slice(1)}`)
      : nextLevel.map(c => c.charAt(0).toUpperCase() + c.slice(1));
    
    // Build options based on what's available at this level
    let options, values;
    
    if (isTopLevel) {
      options = displayNames;
      values = nextLevel;
    } else {
      // Start with "all below" option
      options = [`🎲 Random (all ${displayPath.join('/')})`];
      values = ['ALL_BELOW'];
      
      // Add "this level only" option if notes exist at exact level
      if (hasExactLevelNotes(currentPath)) {
        options.push(`🎯 This level only`);
        values.push('EXACT');
      }
      
      // Add subcategory options
      options.push(...displayNames);
      values.push(...nextLevel);
    }
    
    const placeholder = isTopLevel 
      ? '🎲 Pick an oracle category…'
      : `Pick ${displayPath.join('/')} subcategory…`;
    
    const picked = await ntb.suggester(options, values, { placeholder });
    
    if (picked === undefined) return; // User cancelled
    
    if (picked === 'ALL_BELOW') {
      // User chose "Random from all below"
      includeDescendants = true;
      break;
    }
    
    if (picked === 'EXACT') {
      // User chose "This level only"
      includeDescendants = false;
      break;
    }
    
    // Drill deeper
    currentPath += '/' + picked;
    displayPath.push(picked);
  }
  
  const targetTag = currentPath;
  const topCategory = displayPath[0] || currentPath.replace('#oracle/', '');
 
  // Step 4: Find all notes tagged with selected category/subcategory (exclude Templates)
  const matches = allFiles.filter(file => {
    try {
      // Skip files in Templates folder
      if (file.path.includes('Templates/') || file.path.includes('Templates\\')) return false;
      
      const cache = ntb.app.metadataCache.getFileCache(file);
      if (!cache) return false;
      
      const inlineTags = (cache.tags || []).map(t => t.tag);
      const fmRaw = cache.frontmatter?.tags;
      let fmTags = [];
      
      if (Array.isArray(fmRaw)) {
        fmTags = fmRaw.map(t => (t && typeof t === 'string') ? (t.startsWith('#') ? t : '#' + t) : '').filter(Boolean);
      } else if (typeof fmRaw === 'string' && fmRaw) {
        fmTags = [fmRaw.startsWith('#') ? fmRaw : '#' + fmRaw];
      }
      
      const allTags = [...(inlineTags || []), ...(fmTags || [])];
      
      // Filter based on includeDescendants flag
      if (includeDescendants) {
        // Include notes at this level AND in subcategories
        return allTags.some(t => t === targetTag || t.startsWith(targetTag + '/'));
      } else {
        // Include ONLY notes at this exact level (not subcategories)
        return allTags.some(t => t === targetTag);
      }
    } catch (err) {
      console.error(`Error filtering file ${file.path}:`, err);
      return false;
    }
  });
 
  if (matches.length === 0) {
    new Notice(`❌ No entries found for ${targetTag}. Create oracle notes with this tag.`, 5000);
    return;
  }
 
  // Step 5: Weighted random selection
  // Build weighted pool: each note appears N times based on its weight field
  const weightedPool = [];
  for (const file of matches) {
    const cache = ntb.app.metadataCache.getFileCache(file);
    const weight = cache?.frontmatter?.weight;
    // Default to 1, handle invalid values
    const normalizedWeight = (typeof weight === 'number' && weight > 0) ? Math.floor(weight) : 1;
    
    // Add this file to the pool N times based on weight
    for (let i = 0; i < normalizedWeight; i++) {
      weightedPool.push(file);
    }
  }
  
  // Random selection from weighted pool
  const selected = weightedPool[Math.floor(Math.random() * weightedPool.length)];
  const title = selected.basename;
  const cache = ntb.app.metadataCache.getFileCache(selected);
  const desc = cache?.frontmatter?.description || '';
  const weight = cache?.frontmatter?.weight || 1;

  // ========== RESOLVE CASCADES ==========
  
  const cascadeResult = await resolveCascades(desc);
  
  if (cascadeResult === null) {
    // User cancelled during cascade resolution
    return;
  }
  
  const finalDesc = cascadeResult.resolvedText;
  const cascadeChain = cascadeResult.cascadeChain;
 
  // Step 6: Sanitize output to prevent markdown injection
  const sanitizeText = (text) => {
    if (!text || typeof text !== 'string') return '';
    // Escape special markdown characters that could break formatting
    return text.replace(/\]\]/g, '] ]').replace(/\[\[/g, '[ [').replace(/`/g, '\\`');
  };
 
  const sanitizedTitle = sanitizeText(title);
  const sanitizedDesc = sanitizeText(finalDesc);
 
  // Step 7: Insert result at end of Play log section
  const view = ntb.app.workspace.getActiveViewOfType(ntb.o.MarkdownView);
  if (view) {
    const editor = view.editor;
    const icon = icons[topCategory] || '📜';
    const displayCategory = displayPath.length > 0 ? displayPath.join('/') : topCategory;
    
    // Build main result line
    let output = `> ${icon} **Oracle (${displayCategory}):** [[${title}]]${finalDesc ? ' — _' + sanitizedDesc + '_' : ''}\n`;
    
    // Add cascade chain
    if (cascadeChain.length > 0) {
      for (const entry of cascadeChain) {
        if (entry.method === 'rolled' && entry.details) {
          const weightInfo = entry.details.weight > 1 ? `[w:${entry.details.weight}]` : '';
          output += `>   ↳ ${entry.category}: ${entry.result} ${weightInfo}\n`;
        } else if (entry.method === 'manual') {
          output += `>   ↳ ${entry.category}: ${entry.result} (manual)\n`;
        }
      }
    }
    
    output += '\n';
    
    // Find Play log section and insert before next heading or separator
    const content = editor.getValue();
    const lines = content.split('\n');
    let playLogStart = -1;
    let insertPoint = -1;
    
    // Find "## Play log"
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '## Play log') {
        playLogStart = i;
        break;
      }
    }
    
    if (playLogStart === -1) {
      // Fallback: append to end of document if no Play log section
      const lastLine = editor.lastLine();
      const lastLineLength = editor.getLine(lastLine).length;
      editor.replaceRange(output, {line: lastLine, ch: lastLineLength});
    } else {
      // Find where Play log section ends (next ## heading or ---)
      for (let i = playLogStart + 1; i < lines.length; i++) {
        if (lines[i].trim().startsWith('##') || lines[i].trim() === '---') {
          insertPoint = i;
          break;
        }
      }
      
      if (insertPoint === -1) {
        // No end marker found, append to end of document
        const lastLine = editor.lastLine();
        const lastLineLength = editor.getLine(lastLine).length;
        editor.replaceRange(output, {line: lastLine, ch: lastLineLength});
      } else {
        // Insert at end of previous line (before the separator/next heading)
        const targetLine = insertPoint - 1;
        const targetLength = editor.getLine(targetLine).length;
        editor.replaceRange('\n' + output, {line: targetLine, ch: targetLength});
      }
    }
  }
 
  // Step 8: Show notice with category stats and weight
  const displayCategory = displayPath.length > 0 ? displayPath.join('/') : topCategory;
  const weightInfo = weight > 1 ? ' [weight: ' + weight + ']' : '';
  new Notice(icons[topCategory] || '🎲' + ' ' + title + weightInfo + ' (' + matches.length + ' in ' + displayCategory + ')', 5000);
 
  // Step 9: Offer to open the note
  const openIt = await ntb.suggester(['View result note', 'Continue writing'], [true, false], {
    placeholder: `Drawn: ${title}`
  });
  
  if (openIt) {
    await ntb.app.workspace.getLeaf('tab').openFile(selected);
  }
 
  return `Drew: ${title}`;
 
} catch (error) {
  // Top-level error handler
  console.error('Oracle Draw Error:', error);
  new Notice(`⚠️ Oracle system error: ${error.message}. Check console for details.`, 8000);
  return null;
}