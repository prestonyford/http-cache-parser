
// File signatures
document.getElementById('preset').addEventListener("input", (event) => {
    let preset = event.target.value;
    console.log("Preset changed to " + preset);
    changeSigs(preset);
});

const fileTypeToSignatures = {
    "pdf": ["%PDF-"],
    "png": ["\x89PNG\x0D\x0A\x1A\x0A"],
    "jpg": ["\xFF\xD8\xFF\xE0", "\xFF\xD8\xFF\xE1", "\xFF\xD8\xFF\xE8"],
    "gif": ["GIF87a", "GIF89a"],
    "zip": ["PK\x03\x04"],
    "exe": ["MZ"],
    "mp3": ["ID3", "\xFF\xFB", "\xFF\xF3"],
    "ogg": ["OggS"],
};

function changeSigs(preset) {
    let sigs = document.getElementById('sigs');
    if (preset in fileTypeToSignatures) {
        sigs.value = fileTypeToSignatures[preset].map((type) => convertNonPrintableToHex(type)).join("\n");
    }
}

function convertNonPrintableToHex(inputString) {
    let result = '';
    
    for (let i = 0; i < inputString.length; i++) {
      const charCode = inputString.charCodeAt(i);
      
      // Check if the character is non-printable
      if (charCode < 32 || charCode > 126) {
        // Convert non-printable character to its hexadecimal representation
        result += '\\x' + charCode.toString(16).toUpperCase().padStart(2, '0');
      } else {
        result += inputString[i];
      }
    }
    
    return result;
}


// RESULTS

document.getElementById('search-btn').addEventListener("click", async (event) => {
    event.preventDefault();
    hideResults();

    const query = new URLSearchParams({
        path: document.getElementById('pathInput').value,
        timeframe: document.querySelector('#timeframes-container input[name="timeframe"]:checked').value,
        signatures: encodeURIComponent(JSON.stringify(document.getElementById('sigs').value.split('\n')))
    }).toString();

    await fetch(`/search?${query}`);
});

function hideResults() {
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.style.display = 'none';

    let percent = 0;
    const loadingText = document.getElementById('loading-text');
    loadingText.style.display = 'flow';
    const loadingPercent = document.getElementById('loading-percent');

    let interval = setInterval(async () => {
        if (percent >= 100) {
            await new Promise(r => setTimeout(r, 600));
            loadingText.style.display = 'none';
            resultsContainer.style.display = 'grid';
            clearInterval(interval);
            return;
        }
        percent += 1;
        loadingPercent.innerText = percent;
    }, 4);
}