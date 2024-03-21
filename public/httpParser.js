// File signatures
document.getElementById('preset').addEventListener("input", (event) => {
    let preset = event.target.value;
    console.log("Preset changed to " + preset);
    changeSigs(preset);
});

const fileTypeToSignatures = {
    "pdf": ["%PDF-"],
    "png": ["89 50 4E 47 0D 0A 1A 0A"],
    "jpg": ["FF D8 FF E0", "FF D8 FF EE", "FF D8 FF DB", "FF D8 FF E0 00 10 4A 46 49 46 00 01", "FF D8 FF E1 ?? ?? 45 78 69 66 00 00", "FF D8 FF E8", "FF 4F FF 51", "00 00 00 0C 4A 58 4C 20 0D 0A 87 0A", "FF 0A"], // missing FF D8 FF E1 ?? ?? 45 78 69 66 00 00
    // "gif": ["GIF87a", "GIF89a"],
    "webp": ["52 49 46 46 ?? ?? ?? ?? 57 45 42 50"],
    "zip": ["50 4B 03 04", "50 4B 05 06", "50 4B 07 08"],
    "exe": ["4D 5A"],
    "mp3": ["49 44 33", "FF FB", "FF F3"],
    "ogg": ["4F 67 67 53"],
    // "webp": ["WEBP"]
};

function changeSigs(preset) {
    let sigs = document.getElementById('sigs');
    if (preset in fileTypeToSignatures) {
        sigs.value = fileTypeToSignatures[preset].join("\n");
    }
}

// RESULTS

let results = [];

document.getElementById('search-btn').addEventListener("click", async (event) => {
    event.preventDefault();
    hideResults();

    const signatures = document.getElementById('sigs').value.split('\n');
    let timeframe = document.querySelector('#timeframes-container input[name="timeframe"]:checked').value;
    if (timeframe === "custom") {
        timeframe = document.getElementById('timeframe-custom').value;
    }

    const query = new URLSearchParams({
        path: encodeURIComponent(document.getElementById('pathInput').value),
        timeframe: encodeURIComponent(timeframe),
        signatures: encodeURIComponent(JSON.stringify(signatures))
    }).toString();

    try {
        const response = await fetch(`/search?${query}`);
        if (!response.ok) {
            document.getElementById('loading-text').textContent = await response.text();
            return;
        }
        results = await response.json();
        showResults();
    } catch (err) {
        console.error(err);
        document.getElementById('loading-text').textContent = err.message + " (Is the server running?)";
    
    }
});

document.getElementById('sortby').addEventListener("change", (event) => {
    if (results.length === 0) return;
    sortResults();
    hideResults();
    showResults();
});

function hideResults() {
    document.getElementById('results-container').innerHTML = '';
    const loadingText = document.getElementById('loading-text');
    loadingText.style.display = 'flow';
    loadingText.textContent = 'Loading...';
}

function showResults() {
    const loadingText = document.getElementById('loading-text');
    if (results.length === 0) {
        loadingText.textContent = 'No results found';
        return;
    }

    loadingText.style.display = 'none';
    const resultsContainer = document.getElementById('results-container');

    sortResults();
    for (const file of results) {
        resultsContainer.appendChild(createResult(file));
    }
}

function sortResults() {
    const sortby = document.getElementById('sortby').value;
    results.sort((a, b) => {
        if (sortby === 'name') {
            return a.name.localeCompare(b.name);
        } else if (sortby === 'date') {
            return new Date(a.date) - new Date(b.date);
        } else if (sortby === 'size') {
            return a.size - b.size;
        }
    });
}

function createResult(file) {
    const item = document.createElement('div');
    item.classList.add('item');

    const itemPreview = document.createElement('div');
    itemPreview.classList.add('item-preview');
    
    const preview = createPreview(file);
    itemPreview.appendChild(preview);

    const itemDescription = document.createElement('div');
    itemDescription.classList.add('item-description');
    itemDescription.textContent = `${file.name} - ${file.date} - ${(file.size / 1048576).toFixed(2)} MB`;

    item.appendChild(itemPreview);
    item.appendChild(itemDescription);

    return item;
}

function createPreview(file) {
    switch (file.type) {
        case "image":
            return createImagePreview(file);
        case "audio":
            return createAudioPreview(file);
        default:
            return createImagePreview(file);
    }
}

function createImagePreview(file) {
    const img = document.createElement('img');
    const binaryString = window.atob(file.buffer);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = buffer.buffer;
    const blob = new Blob([arrayBuffer]); // , { type: 'image/png' }
    img.src = URL.createObjectURL(blob);
    img.alt = "no preview available";
    return img;
};

function createAudioPreview(file) {
    const audio = document.createElement('audio');
    const binaryString = window.atob(file.buffer);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = buffer.buffer;
    const blob = new Blob([arrayBuffer] , { type: 'audio/mpeg' }); // , { type: 'audio/mpeg' }
    audio.src = URL.createObjectURL(blob);
    audio.controls = true;
    return audio;
}