let fileTypeToSignatures;
fetch(`/fileTypeToSignatures`).then(async response => {
    if (response.ok) {
        fileTypeToSignatures = await response.json();
    }
})
let results = [];


/*
    DOCUMENT LISTENERS
*/
document.getElementById('preset').addEventListener("input", (event) => {
    let preset = event.target.value;
    console.log("Preset changed to " + preset);
    changeSigs(preset);
});

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
    hideResults();
    showResults();
});

document.querySelectorAll('input[name="ascendingdescending"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        hideResults();
        showResults();
    });
});


/*
    HELPERS
*/
function changeSigs(preset) {
    let sigs = document.getElementById('sigs');
    if (preset in fileTypeToSignatures) {
        sigs.value = fileTypeToSignatures[preset].join("\n");
    }
}

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
    const sortorder = Number(document.querySelector('#ascendingdescending-container input[name="ascendingdescending"]:checked').value);
    results.sort((a, b) => {
        if (sortby === 'name') {
            return sortorder * a.name.localeCompare(b.name);
        } else if (sortby === 'date') {
            return sortorder * (new Date(a.date) - new Date(b.date));
        } else if (sortby === 'size') {
            return sortorder * (a.size - b.size);
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
    // if (file.type === 'image') {
    //     itemDescription.textContent += ` (w: ${preview.width}px, h: ${preview.height}px)`;
    // }

    item.appendChild(itemPreview);
    item.appendChild(itemDescription);

    return item;
}

function createPreview(file) {
    switch (file.type.split('/')[0]) {
        case "image":
            return _createImagePreview(file);
        case "audio":
            return _createAudioPreview(file);
        default:
            return _createImagePreview(file);
    }
}

function _createImagePreview(file) {
    const div = document.createElement('div');
    div.classList.add('image-preview');

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

    div.appendChild(img);

    const info = document.createElement('div');
    info.classList.add('image-info');

    img.onload = () => {
        info.textContent = `w: ${img.width}px, h: ${img.height}px`;
    }

    div.appendChild(info);

    return div;
};

function _createAudioPreview(file) {
    const div = document.createElement('div');
    div.classList.add('audio-preview');
    
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

    div.appendChild(audio);
    return div;
}