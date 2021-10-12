// Get twitter information when searched
let count = 0;
const streamAmount = 5;


const twitterData = (event) => {
    event.preventDefault();
    const searchedTerm = document.getElementById('searchText').value
    document.getElementById('searchText').value = '';
    //console.log(searchEvent.target.textContent);
    const dummyData = {
        title: searchedTerm,
        sentiment: 0.5 + count
    };
    console.log(searchedTerm);
    console.log(count % streamAmount);
    const chosenDiv = (document.getElementsByClassName('stream')).item(count % streamAmount);
    while(chosenDiv.firstChild){
        chosenDiv.removeChild(chosenDiv.firstChild)
    }
    const heading = document.createElement("h3");
    heading.textContent =  dummyData.title;
    chosenDiv.appendChild(heading);
    const sentiment = document.createElement("p");
    sentiment.textContent =  dummyData.sentiment;
    chosenDiv.appendChild(sentiment);
    count++;
}

document.getElementById('searchForm').addEventListener('submit', twitterData);