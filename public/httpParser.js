
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
        sigs.value = fileTypeToSignatures[preset].map((type) => encodeHex(type)).join("\n");
    }
}

function encodeHex(inputString) {
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

function decodeHex(inputString) {
    let words = inputString.split(/\\x[0-9A-Fa-f]{2}/g).filter((word) => word !== '');

    for (const word of words) {
        let unicodeWord = '';
        for (let i = 0; i < word.length; ++i) {
            unicodeWord += word.charCodeAt(i).toString(16).toUpperCase().padStart(2, '0');
        }

        inputString = inputString.replace(word, unicodeWord);
        console.log(inputString);
    }

    let result = inputString.replace(/\\x([0-9A-Fa-f]{2})/g, (_, group) => {
        return group;
    });

    return result;
}


// RESULTS

document.getElementById('search-btn').addEventListener("click", async (event) => {
    event.preventDefault();
    hideResults();

    const signatures = document.getElementById('sigs').value.split('\n');

    const query = new URLSearchParams({
        path: encodeURIComponent(document.getElementById('pathInput').value),
        timeframe: document.querySelector('#timeframes-container input[name="timeframe"]:checked').value,
        signatures: encodeURIComponent(JSON.stringify(signatures.map((signature) => decodeHex(signature))))
    }).toString();

    const response = await fetch(`/search?${query}`);
    const files = await response.json();
    showResults(files);
});

function hideResults() {
    document.getElementById('results-container').innerHTML = '';
    const loadingText = document.getElementById('loading-text');
    loadingText.style.display = 'flow';
}

function showResults(files) {
    const loadingText = document.getElementById('loading-text');
    loadingText.style.display = 'none';

    const resultsContainer = document.getElementById('results-container');
    for (const file of files) {
        resultsContainer.appendChild(createResult(file));
    }
}

function createResult(file) {
    const item = document.createElement('div');
    item.classList.add('item');

    const itemPreview = document.createElement('div');
    itemPreview.classList.add('item-preview');
    const img = document.createElement('img');
    // console.log(file.buffer);
    const binaryString = window.atob(file.buffer);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = buffer.buffer;
    const blob = new Blob([arrayBuffer], { type: 'image/png' });
    img.src = URL.createObjectURL(blob);
    img.alt = "no preview available";
    itemPreview.appendChild(img);

    const itemDescription = document.createElement('div');
    itemDescription.classList.add('item-description');
    itemDescription.textContent = `${file.name} - ${file.date} - ${file.size} bytes`;

    item.appendChild(itemPreview);
    item.appendChild(itemDescription);

    return item;
}