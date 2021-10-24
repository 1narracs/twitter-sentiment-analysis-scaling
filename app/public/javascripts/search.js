// Get twitter information when searched
const twitterProfileAmount = 5;
let count = 0;

var serverDataPreped = {
    hashtagData: [],
    importantWords: []
};

const twitterData = (event) => {
    event.preventDefault();
    let searchedTerm = document.getElementById('searchText').value
    document.getElementById('searchText').value = '';
    //console.log(searchEvent.target.textContent);

    searchedTerm = searchedTerm.replace(/[^a-zA-Z]+/g, ' ');
    searchedTerm = searchedTerm.trim();

    const warningDiv = document.getElementById('warning');
    while (warningDiv.firstChild) {
        warningDiv.removeChild(warningDiv.firstChild)
    }
    if (searchedTerm == '') {
        const warningText = document.createElement("p");
        warningText.textContent = "Bad search, please only use letters.";
        warningDiv.appendChild(warningText);
    }
    else {
        const searchedTerms = searchedTerm.split(' ');
        searchedTerms.forEach(element => {
            fetch(`/data/twitter/${element.toLowerCase()}`)
                .then((response) => {
                    return response.json();
                })
                .then((data) => {
                    // Handle server data block

                    console.log(data);

                    SetUpServerData(data);

                    drawBarChart(serverDataPreped);

                    drawTidyTree(serverDataPreped);

                    console.log(serverDataPreped);

                    if (data.source == "No Source") {
                        // No source block
                        const noData = document.createElement("p");
                        noData.textContent = 'No data was able to be retrived!';
                        warningDiv.appendChild(noData);
                    }
                    else {

                    }
                })
                .catch((error) => {
                    // There may be an issue with .env / twitter API key stuff
                    console.log(error);
                })
        });
    }
}


// Function to set up data object that can be handled by visualisations.js
function SetUpServerData(data) {
    let hashtagObjArray = [];
    let importantWordsObj = { name: data.id, children: [] };


    // Remove the oldest data from the data obj if its length exceed the maximum allowed length
    if (serverDataPreped.importantWords.length >= twitterProfileAmount && serverDataPreped.hashtagData.length >= twitterProfileAmount * 6) {
        serverDataPreped.importantWords.shift();
        serverDataPreped.hashtagData.splice(0, 6); // start index 0, delete 6 items (6 is the length of sentiments array)
    };

    // Construct data object
    // Order should be v-n, n, sw-n, sw-p, p, v-p
    hashtagObjArray[0] = { hashtag: data.id, sentiment: 'very-negative', value: data.sentimentsVeryNegative };
    hashtagObjArray[1] = { hashtag: data.id, sentiment: 'negative', value: data.sentimentsNegative };
    hashtagObjArray[2] = { hashtag: data.id, sentiment: 'somewhat-negative', value: data.sentimentsSomewhatNegative };
    hashtagObjArray[3] = { hashtag: data.id, sentiment: 'somewhat-positive', value: data.sentimentsSomewhatPositive };
    hashtagObjArray[4] = { hashtag: data.id, sentiment: 'positive', value: data.sentimentsPositive };
    hashtagObjArray[5] = { hashtag: data.id, sentiment: 'very-positive', value: data.sentimentsVeryPositive };

    // Construct the array for the important terms of the provided data object
    data.importantTerms.forEach(element => {
        importantWordsObj.children.push({ name: element });
    })

    serverDataPreped.importantWords.push(importantWordsObj);
    serverDataPreped.hashtagData = serverDataPreped.hashtagData.concat(hashtagObjArray);
};

document.getElementById('searchForm').addEventListener('submit', twitterData);

const serverDataTest = {
    hashtagData: [
        { hashtag: 'batman', sentiment: 'very-negative', value: '2' },
        { hashtag: 'batman', sentiment: 'negative', value: '4' },
        { hashtag: 'batman', sentiment: 'somewhat-negative', value: '7' },
        { hashtag: 'batman', sentiment: 'somewhat-positive', value: '15' },
        { hashtag: 'batman', sentiment: 'positive', value: '8' },
        { hashtag: 'batman', sentiment: 'very-positive', value: '10' },
        { hashtag: 'spiderman', sentiment: 'very-negative', value: '20' },
        { hashtag: 'spiderman', sentiment: 'negative', value: '3' },
        { hashtag: 'spiderman', sentiment: 'somewhat-negative', value: '9' },
        { hashtag: 'spiderman', sentiment: 'somewhat-positive', value: '14' },
        { hashtag: 'spiderman', sentiment: 'positive', value: '13' },
        { hashtag: 'spiderman', sentiment: 'very-positive', value: '3' }
    ],
    importantWords:
        [{
            name: 'batman',
            children: [
                { name: "jamesthefourth" },
                { name: "amazing" },
                { name: "tomeu" },
                { name: "morey" },
                { name: "care" },
                { name: "anyway" },
                { name: "script" },
                { name: "colors" },
                { name: "oh" },
                { name: "wow" }
            ]
        },
        {
            name: 'spiderman',
            children: [
                { name: "hello" },
                { name: "this" },
                { name: "is" },
                { name: "a" },
                { name: "test" },
                { name: "wow" }
            ]
        }
        ]
};
