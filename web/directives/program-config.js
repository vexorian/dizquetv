module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/program-config.html',
        replace: true,
        scope: {
            program: "=program",
            visible: "=visible",
            onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            // Conversion functions remain the same (using NaN for invalid)
            scope.msToTimeString = function(ms) {
                if (typeof ms !== 'number' || isNaN(ms) || ms < 0) { return ''; }
                let totalS = Math.floor(ms / 1000);
                let s = totalS % 60;
                let m = Math.floor(totalS / 60);
                return m + ":" + ( (s < 10) ? ("0" + s) : s );
            };
            
            scope.timeStringToMs = function(timeString) {
                if (timeString == null || timeString.trim() === '') { return 0; } // Empty is 0ms
                let parts = timeString.split(':');
                if (parts.length !== 2) { return NaN; } // Invalid format
                let min = parseInt(parts[0], 10);
                let sec = parseInt(parts[1], 10);
                if (isNaN(min) || isNaN(sec) || sec < 0 || sec >= 60 || min < 0) { return NaN; } // Invalid numbers
                return (min * 60 + sec) * 1000;
            };
            
            // Intermediate model for UI binding
            scope.timeInput = {
                seek: '',
                end: ''
            };
            
            let initialProgramLoad = true; // Flag for first load

            // Watch program to initialize/reset intermediate model ONLY
            scope.$watch('program', function(newProgram) {
                if (newProgram) {
                    console.log("Program loaded/changed. Initializing timeInput.");
                    // Initialize timeInput from program data
                    let initialSeekMs = newProgram.seekPosition;
                    let initialEndMs = newProgram.endPosition;

                    scope.timeInput.seek = scope.msToTimeString( (typeof initialSeekMs === 'number' && !isNaN(initialSeekMs)) ? initialSeekMs : 0 );
                    scope.timeInput.end = (typeof initialEndMs === 'number' && !isNaN(initialEndMs) && initialEndMs > 0) ? scope.msToTimeString(initialEndMs) : '';
                    
                    initialProgramLoad = false; // Mark initial load complete
                } else {
                    // Clear inputs if program is removed
                    scope.timeInput.seek = '';
                    scope.timeInput.end = '';
                    initialProgramLoad = true; // Reset flag if program is cleared
                }
            });

            scope.finished = (prog) => {
                // prog here is the original program object passed to the directive
                // We need to validate and apply changes from scope.timeInput

                let currentError = null;

                // --- Validate Time Inputs ---
                let seekInputString = scope.timeInput.seek;
                let endInputString = scope.timeInput.end;

                let seekMs = scope.timeStringToMs(seekInputString);
                let endMs = scope.timeStringToMs(endInputString); // Will be 0 if empty, NaN if invalid

                // Check for invalid formats (NaN)
                if (isNaN(seekMs)) {
                    currentError = { seekPosition: 'Invalid start time format. Use MM:SS.' };
                } else if (isNaN(endMs) && endInputString && endInputString.trim() !== '') {
                    // Only error on endMs if it's not empty but is invalid
                    currentError = { endPosition: 'Invalid end time format. Use MM:SS.' };
                } else {
                    // Format is valid or empty, now check relationship
                    // Treat endMs === 0 (from empty input) as 'undefined' for comparison
                    let effectiveEndMs = (endMs === 0 && (endInputString == null || endInputString.trim() === '')) ? undefined : endMs;

                    // Validate Seek Position against Duration first
                    if (prog.duration && seekMs >= (prog.duration - 1000)) {
                        currentError = currentError || {};
                        currentError.seekPosition = 'Start time must be at least 1 second before the program ends.';
                    }
                    // Then validate End Position if specified
                    else if (typeof effectiveEndMs === 'number') { 
                        if (effectiveEndMs <= seekMs) {
                            currentError = currentError || {};
                            currentError.endPosition = 'End position must be greater than start position.';
                        } else if (prog.duration && effectiveEndMs > prog.duration) {
                            // Error if end time EXCEEDS program duration
                            currentError = currentError || {};
                            currentError.endPosition = 'End position cannot exceed program duration (' + scope.msToTimeString(prog.duration) + ').';
                        } 
                        // Check if start/end combination is valid (at least 1s apart)
                        else if ((effectiveEndMs - seekMs) < 1000) {
                             currentError = currentError || {};
                             // Apply error to the field being edited or a general one if needed
                             currentError.endPosition = 'Effective program length must be at least 1 second.'; 
                        }
                    }
                }

                // --- Standard Validation (on original prog object) ---
                if (!currentError) { // Only proceed if time validation passed
                    if (!prog.title) { currentError = { title: 'You must set a program title.' }; }
                    else if (prog.type === "episode" && !prog.showTitle) { currentError = { showTitle: 'You must set a show title when the program type is an episode.' }; }
                    else if (prog.type === "episode" && (prog.season == null || prog.season <= 0)) { currentError = { season: 'Season number must be greater than 0.' }; }
                    else if (prog.type === "episode" && (prog.episode == null || prog.episode <= 0)) { currentError = { episode: 'Episode number must be greater than 0.' }; }
                    // Add any other existing standard validations here, setting currentError
                }

                // --- Error Handling ---
                if (currentError && Object.keys(currentError).length !== 0) {
                    scope.error = currentError;
                    $timeout(() => { scope.error = null }, 3500);
                    return; // Stop execution
                }

                // --- Prepare Final Object ---
                // Create a clean object based on the original prog and validated time inputs
                // Ensure seekMs is a valid number before assigning
                let finalSeekMs = isNaN(seekMs) ? 0 : seekMs; 
                // Ensure endMs is valid number > 0 or undefined
                let finalEndMs = (typeof endMs === 'number' && !isNaN(endMs) && endMs > 0) ? endMs : undefined;

                let finalProgData = {
                    ...prog, // Copy original properties
                    seekPosition: finalSeekMs, 
                    endPosition: finalEndMs 
                };

                // Explicitly remove endPosition if undefined
                if (finalProgData.endPosition === undefined) {
                    delete finalProgData.endPosition;
                }

                console.log("Validation passed. Calling onDone with:", finalProgData);
                scope.onDone(JSON.parse(angular.toJson(finalProgData)));
                scope.program = null;
            }
        }
    };
}
