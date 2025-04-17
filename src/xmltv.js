const XMLWriter = require('xml-writer');
const fs        = require('fs');
const constants = require('./constants');

module.exports = { WriteXMLTV, shutdown };

let isShutdown = false;
let isWorking  = false;

// ────────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────────────────
async function WriteXMLTV(json, xmlSettings, throttle, cacheImageService) {
  if (isShutdown) return;
  if (isWorking) {
    console.log('Concurrent xmltv write attempt detected, skipping');
    return;
  }
  isWorking = true;
  try {
    await writePromise(json, xmlSettings, throttle, cacheImageService);
  } catch (err) {
    console.error('Error writing xmltv', err);
  } finally {
    isWorking = false;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
function writePromise(json, xmlSettings, throttle, cacheImageService) {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(xmlSettings.file);
    const xw = new XMLWriter(true, (str, enc) => ws.write(str, enc));

    ws.on('finish', resolve);
    ws.on('error', reject);

    _writeDocStart(xw);

    (async () => {
      console.log('XMLTV Debug: Writing XMLTV file');
      
      const channelNumbers = Object.keys(json);
      console.log('XMLTV Debug: Channel numbers:', channelNumbers);
      
      // First write all channel elements
      const channels = channelNumbers.map(n => json[n].channel);
      _writeChannels(xw, channels);

      // Then write all programs for each channel
      for (const number of channelNumbers) {
        console.log(`XMLTV Debug: Processing channel ${number}`);
        
        // Skip if programs array is missing or empty
        if (!Array.isArray(json[number].programs) || json[number].programs.length === 0) {
          console.error(`XMLTV Debug: ERROR - No programs array or empty array for channel ${number}`);
          continue;
        }
        
        console.log(`XMLTV Debug: Programs before merge: ${json[number].programs.length}`);
        
        // Merge programs to eliminate placeholders and combine related content
        const merged = _smartMerge(json[number].programs);
        console.log(`XMLTV Debug: Programs after merge: ${merged.length}`);
        
        if (merged.length > 0) {
          // Write the merged programs
          await _writePrograms(xw, json[number].channel, merged, throttle, xmlSettings, cacheImageService);
        } else {
          console.error('XMLTV Debug: ERROR - No programs after merge');
        }
      }
    })()
      .then(() => _writeDocEnd(xw, ws))
      .catch(err => console.error('Error in XMLTV generation:', err))
      .finally(() => ws.end());
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// MERGE LOGIC – completely eliminate placeholders
// ────────────────────────────────────────────────────────────────────────────────
function _smartMerge(programs) {
  if (!Array.isArray(programs) || programs.length === 0) {
    return [];
  }

  // Debug log for input
  console.log(`_smartMerge received ${programs.length} programs`);

  // Helper functions for date handling
  function ms(t) { 
    try {
      return Date.parse(t); 
    } catch (e) {
      console.error('Error parsing date:', t, e);
      return 0;
    }
  }
  
  function gap(a, b) { 
    try {
      return ms(b.start) - ms(a.stop); 
    } catch (e) {
      console.error('Error calculating gap:', e);
      return 999999; // Large gap to prevent merging on error
    }
  }
  
  // Flex/placeholder program detection
  function getChannelStealthDuration(channel) {
    if (channel && 
        typeof(channel.guideMinimumDurationSeconds) !== 'undefined' && 
        !isNaN(channel.guideMinimumDurationSeconds)) {
      return channel.guideMinimumDurationSeconds * 1000;
    }
    return constants.DEFAULT_GUIDE_STEALTH_DURATION;
  }
  
  function isProgramFlex(program, channel) {
    const stealthDuration = getChannelStealthDuration(channel);
    return program.isOffline || 
           (program.duration && program.duration <= stealthDuration);
  }
  
  // Program similarity detection
  function isSameShow(a, b) {
    if (!a || !b) return false;
    
    // Check rating keys first (most reliable)
    if (a.ratingKey && b.ratingKey && a.ratingKey === b.ratingKey) {
      return true;
    }
    
    // Check show title and type
    if (a.showTitle && b.showTitle && a.showTitle === b.showTitle) {
      if (a.type === 'episode' && b.type === 'episode') {
        // For episodes, check if they're sequential
        if (a.season === b.season) {
          return Math.abs((a.episode || 0) - (b.episode || 0)) <= 1;
        }
        return false;
      }
      // For non-episodes with same title (movies, etc)
      return a.type === b.type && a.type !== 'episode';
    }
    
    return false;
  }
  
  function isExactDuplicate(a, b) {
    if (!a || !b) return false;
    
    return a.title === b.title && 
           ((a.sub && b.sub && a.sub.season === b.sub.season && a.sub.episode === b.sub.episode) || 
            (!a.sub && !b.sub)) &&
           a.summary === b.summary &&
           a.rating === b.rating &&
           (a.ratingKey === b.ratingKey || (!a.ratingKey && !b.ratingKey));
  }

  // Get channel info and define thresholds
  const channel = programs.length > 0 && programs[0].channel ? programs[0].channel : {
    guideMinimumDurationSeconds: constants.DEFAULT_GUIDE_STEALTH_DURATION / 1000,
    name: "dizqueTV"
  };
  
  const flexTitle = channel.guideFlexPlaceholder || channel.name;
  const ADJACENT_THRESHOLD = 30 * 1000; // 30 seconds
  const SAME_SHOW_MAX_GAP = 10 * 60 * 1000; // 10 minutes

  // Step 0: Filter and prepare programs
  let validPrograms = programs.filter(p => {
    if (!p.start || !p.stop) return false;
    
    // Ensure title exists
    if (!p.title) p.title = p.showTitle || 'Unknown';
    if (!p.summary) p.summary = '';
    
    // Validate that start is before stop
    return ms(p.start) < ms(p.stop);
  }).sort((a, b) => ms(a.start) - ms(b.start));

  // Step 1: Merge related content blocks and remove flex
  const firstPass = [];
  
  for (let i = 0; i < validPrograms.length; i++) {
    const prog = validPrograms[i];
    
    // Skip flex/placeholder programs
    if (isProgramFlex(prog, channel)) continue;
    
    if (firstPass.length === 0) {
      firstPass.push(prog);
      continue;
    }
    
    const lastProg = firstPass[firstPass.length - 1];
    const gapDuration = gap(lastProg, prog);
    
    if (gapDuration <= ADJACENT_THRESHOLD) {
      // Adjacent programs with same title - merge
      if (isSameShow(lastProg, prog) || (lastProg.title === prog.title && lastProg.type === prog.type)) {
        lastProg.stop = prog.stop;
      } else {
        // Different content - add separately
        firstPass.push(prog);
      }
    } else if (gapDuration <= SAME_SHOW_MAX_GAP && isSameShow(lastProg, prog)) {
      // Small gap between same show segments - merge
      lastProg.stop = prog.stop;
    } else {
      // Large gap or different content - add separately
      firstPass.push(prog);
    }
  }
  
  // Step 2: Close gaps between programs
  const finalResult = [];
  
  for (let i = 0; i < firstPass.length; i++) {
    const prog = firstPass[i];
    
    if (i === 0) {
      finalResult.push(prog);
      continue;
    }
    
    const lastProg = finalResult[finalResult.length - 1];
    
    // Close any gaps by extending previous program
    if (gap(lastProg, prog) > 0) {
      lastProg.stop = prog.start;
    }
    
    finalResult.push(prog);
  }
  
  // Step 3: Split overly long segments
  const splitResult = [];
  
  for (const prog of finalResult) {
    const duration = ms(prog.stop) - ms(prog.start);
    
    if (duration > constants.TVGUIDE_MAXIMUM_FLEX_DURATION) {
      // Split into manageable segments
      let currentStart = new Date(prog.start);
      const endTime = new Date(prog.stop);
      
      while (currentStart < endTime) {
        const segmentEnd = new Date(Math.min(
          currentStart.getTime() + constants.TVGUIDE_MAXIMUM_FLEX_DURATION,
          endTime.getTime()
        ));
        
        splitResult.push({
          ...prog,
          start: currentStart.toISOString(),
          stop: segmentEnd.toISOString()
        });
        
        currentStart = segmentEnd;
      }
    } else {
      splitResult.push(prog);
    }
  }
  
  // Step 4: Final verification and cleanup
  // Remove any remaining flex content
  for (let i = 0; i < splitResult.length; i++) {
    const prog = splitResult[i];
    
    if (prog.title === flexTitle || isProgramFlex(prog, channel)) {
      console.error(`ERROR: Flex content found after processing! This should not happen.`);
      
      if (splitResult.length > 1) {
        // Fix by extending adjacent programs
        if (i > 0) {
          splitResult[i - 1].stop = prog.stop;
        } else if (i < splitResult.length - 1) {
          splitResult[i + 1].start = prog.start;
        }
        
        splitResult.splice(i, 1);
        i--;
      }
    }
  }
  
  // Fix any remaining gaps
  for (let i = 1; i < splitResult.length; i++) {
    const prevStop = ms(splitResult[i-1].stop);
    const currStart = ms(splitResult[i].start);
    
    if (currStart - prevStop > 1000) {
      console.error(`ERROR: Gap detected after processing: ${new Date(prevStop).toISOString()} - ${new Date(currStart).toISOString()}`);
      splitResult[i-1].stop = splitResult[i].start;
    }
  }
  
  // Step 5: Merge consecutive identical programs
  console.log('XMLTV Debug: Starting final pass to merge identical consecutive programs');
  const deduplicatedResult = [];
  let lastProgram = null;
  
  for (const prog of splitResult) {
    if (lastProgram === null) {
      deduplicatedResult.push(prog);
      lastProgram = prog;
      continue;
    }
    
    // Merge exact duplicates
    if (isExactDuplicate(lastProgram, prog) && 
        Math.abs(ms(lastProgram.stop) - ms(prog.start)) <= ADJACENT_THRESHOLD) {
      console.log(`XMLTV Debug: Merging duplicate program: ${prog.title}`);
      lastProgram.stop = prog.stop;
    } else {
      deduplicatedResult.push(prog);
      lastProgram = prog;
    }
  }
  
  console.log(`XMLTV Debug: Final pass reduced from ${splitResult.length} to ${deduplicatedResult.length} programs`);
  console.log(`_smartMerge returning ${deduplicatedResult.length} programs (from original ${programs.length})`);
  
  return deduplicatedResult;
}

// ────────────────────────────────────────────────────────────────────────────────
// XML WRITING HELPERS (unchanged below)
// ────────────────────────────────────────────────────────────────────────────────
function _writeDocStart(xw) {
  xw.startDocument();
  xw.startElement('tv');
  xw.writeAttribute('generator-info-name', 'dizquetv');
}

function _writeDocEnd(xw, ws) {
  xw.endElement();
  xw.endDocument();
}

function _writeChannels(xw, channels) {
  for (const ch of channels) {
    xw.startElement('channel');
    xw.writeAttribute('id', ch.number);
    xw.startElement('display-name');
    xw.writeAttribute('lang', 'en');
    xw.text(ch.name);
    xw.endElement();
    if (ch.icon) {
      xw.startElement('icon');
      xw.writeAttribute('src', ch.icon);
      xw.endElement();
    }
    xw.endElement();
  }
}

async function _writePrograms(xw, channel, programs, throttle, xmlSettings, cacheImageService) {
  // Log the number of programs to be written
  console.log(`Writing ${programs.length} programs for channel ${channel.number}`);
  
  // Process each program with throttling
  for (const prog of programs) {
    if (isShutdown) break; // Early exit if shutdown requested
    await throttle();
    await _writeProgramme(channel, prog, xw, xmlSettings, cacheImageService);
  }
}

async function _writeProgramme(channel, prog, xw, xmlSettings, cacheImageService) {
  try {
    // Validate program data
    if (!prog.start || !prog.stop) {
      console.error('ERROR: Program missing start or stop time:', prog.title || 'Unknown');
      return; // Skip invalid program
    }
    
    // Format dates and validate
    let startDate, stopDate;
    try {
      startDate = _xmltvDate(prog.start);
      stopDate = _xmltvDate(prog.stop);
    } catch (e) {
      console.error('ERROR: Invalid date format in program:', prog.title, e.message);
      return; // Skip program with invalid dates
    }
    
    // Write program element and attributes
    xw.startElement('programme');
    xw.writeAttribute('start', startDate);
    xw.writeAttribute('stop', stopDate);
    xw.writeAttribute('channel', channel.number);

    // Write title
    xw.startElement('title');
    xw.writeAttribute('lang', 'en');
    xw.text(prog.title);
    xw.endElement();
    
    // Add previously-shown tag
    xw.writeRaw('\n        <previously-shown/>');

    // Add episode information if available
    if (prog.sub) {
      // Subtitle (episode title)
      xw.startElement('sub-title');
      xw.writeAttribute('lang', 'en');
      xw.text(prog.sub.title);
      xw.endElement();

      // Episode numbering in human-readable format
      xw.startElement('episode-num');
      xw.writeAttribute('system', 'onscreen');
      xw.text(`S${prog.sub.season} E${prog.sub.episode}`);
      xw.endElement();

      // Episode numbering in XMLTV standard format (zero-based)
      xw.startElement('episode-num');
      xw.writeAttribute('system', 'xmltv_ns');
      xw.text(`${prog.sub.season - 1}.${prog.sub.episode - 1}.0/1`);
      xw.endElement();
    }

    // Add program icon/thumbnail if available
    if (prog.icon) {
      xw.startElement('icon');
      let icon = prog.icon;
      if (xmlSettings.enableImageCache) {
        icon = `{{host}}/cache/images/${cacheImageService.registerImageOnDatabase(icon)}`;
      }
      xw.writeAttribute('src', icon);
      xw.endElement();
    }

    // Add program description
    xw.startElement('desc');
    xw.writeAttribute('lang', 'en');
    xw.text(prog.summary && prog.summary.length > 0 ? prog.summary : channel.name);
    xw.endElement();

    // Add content rating if available
    if (prog.rating) {
      xw.startElement('rating');
      xw.writeAttribute('system', 'MPAA');
      xw.writeElement('value', prog.rating);
      xw.endElement();
    }

    xw.endElement(); // Close programme element
  } catch (error) {
    console.error('Error writing program:', prog.title || 'Unknown', error.message);
  }
}

function _xmltvDate(iso) {
  return iso.substring(0, 19).replace(/[-T:]/g, '') + ' +0000';
}

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

async function shutdown() {
  isShutdown = true;
  console.log('Shutting down xmltv writer.');
  while (isWorking) {
    console.log('Waiting for xmltv writer to finish…');
    await wait(100);
  }
  console.log('xmltv writer idle.');
}