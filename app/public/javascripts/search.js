// Get twitter information when searched
const twitterProfileAmount = 5;
let count = 0;

const twitterData = (event) => {
    event.preventDefault();
    let searchedTerm = document.getElementById('searchText').value
    document.getElementById('searchText').value = '';
    //console.log(searchEvent.target.textContent);

    searchedTerm = searchedTerm.replace(/[^a-zA-Z]+/g, ' ');
    searchedTerm = searchedTerm.trim();

    const warningDiv = document.getElementById('warning');
    while(warningDiv.firstChild){
        warningDiv.removeChild(warningDiv.firstChild)
    }
    if (searchedTerm == ''){
        const warningText = document.createElement("p");
        warningText.textContent =  "Bad search, please only use letters.";
        warningDiv.appendChild(warningText);
    }
    else{
        const searchedTerms = searchedTerm.split(' ');
        searchedTerms.forEach(element => {
            fetch(`/data/twitter/${element.toLowerCase()}`)
            .then( (response) => {
                return response.json();
            })
            .then ((data) => {
                // Handle server data block
                
                console.log(data);
                // const chosenDiv = (document.getElementsByClassName('stream')).item(count % twitterProfileAmount);
                // count++;
                // while(chosenDiv.firstChild){
                //     chosenDiv.removeChild(chosenDiv.firstChild)
                // }
                // const heading = document.createElement("h3");
                // heading.textContent =  element;
                // chosenDiv.appendChild(heading);
                if (data.source == "No Source"){
                    // No source block
                    const noData = document.createElement("p");
                    noData.textContent =  'No data was able to be retrived!';
                    warningDiv.appendChild(noData);
                }
                else{
                    // Found source block
                    const sentiment = document.createElement("p");
                    sentiment.textContent =  'Overall sentiment: ' + data.overallSentiment;
                    chosenDiv.appendChild(sentiment);
                    const importantTerms = document.createElement("p");
                    importantTerms.textContent =  'Important terms: ' + data.importantTerms;
                    chosenDiv.appendChild(importantTerms);
                }
            })
            .catch((error) =>{
                // There may be an issue with .env / twitter API key stuff
                console.log(error);
            })
        });
    }
}

// Function to set up data object that can be handled by visualisations.js
function SetUpServerData(data) {
    serverDataPreped = {hashtagData: [],
    importantWords:[]};

    hashtagObj = {hashtag: '', sentiment: '', value: ''};

    importantWordsObj = {name: '', children: []};

    wordObj = {name: ''};
};

document.getElementById('searchForm').addEventListener('submit', twitterData);

const serverData= {hashtagData: [
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
            { name: "jamesthefourth"},
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
