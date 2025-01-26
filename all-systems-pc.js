require("dotenv").config({ path: ".env.local" });

const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DB_ID;

console.log("notionToken: " + notionToken);
console.log("databaseId: " + databaseId);

const notionAPI =
  "https://api.notion.com/v1/databases/" + databaseId + "/query";

const fetchData = async () => {
  console.log(notionAPI);
  console.log("\n");

  console.log(notionToken);

  const response = await fetch(notionAPI, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2021-05-13", // Assure-toi que tu utilises la version correcte de l'API
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    console.dir(response);
    throw new Error("Erreur lors de la récupération des données de Notion");
  }

  const data = await response.json();
  // console.log("data");
  // console.dir(data);
  const listSysName = formatResponseFromApi(data);
  console.log(JSON.stringify(listSysName, null, 4));
};

function isSameDay(dataNext, dataNow) {
  return (
    dataNow.getFullYear() === dataNext.getFullYear() &&
    dataNow.getMonth() === dataNext.getMonth() &&
    dataNow.getDate() === dataNext.getDate()
  );
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Les mois commencent à 0
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function isTodayOrBefore(dateToCompare, today) {
  // const todayFormatted = formatDate(today);
  // const formattedDateToCompare = formatDate(dateToCompare);

  const todayFormatted = today.setHours(0, 0, 0, 0);
  const formattedDateToCompare = dateToCompare.setHours(0, 0, 0, 0);

  console.log(
    "todayFormatted: " + todayFormatted + "  typeof : " + typeof todayFormatted
  );
  console.log(
    "formattedDateToCompare: " +
      formattedDateToCompare +
      "  typeof : " +
      typeof formattedDateToCompare
  );
  console.log(
    "formattedDateToCompare <= todayFormatted: " + formattedDateToCompare <=
      todayFormatted
  );

  console.log(
    "formattedDateToCompare <= todayFormatted: " +
      parseInt(formattedDateToCompare) -
      parseInt(todayFormatted)
  );

  return formattedDateToCompare <= todayFormatted;
}

function formatResponseFromApi(json) {
  const dateNow = new Date();

  return json.results
    .map((page, _) => {
      const dataId = page.properties["Système"].title[0].mention.page.id;
      const dataName = page.properties["Système"].title[0].plain_text;
      const dataUrl = page.properties["Système"].title[0].href;

      const dataPrevious = new Date(page.properties["Previous"].formula.string);
      const dataNext = new Date(page.properties["Next"].formula.date.start);

      const dataCategorie = page.properties["Catégorie"].select.name;
      const dataJours = page.properties["Jours"].formula.number;

      const dataActions = page.properties["Actions"].formula.string;
      const dataCommentaire = page.properties["Commentaire"].formula.string;

      console.log("dataId");
      console.log(dataId);

      return {
        dataId,
        dataName,
        dataUrl,
        dataCategorie,
        dataJours,
        dataNext,
        dataPrevious,
        dataActions,
        dataCommentaire,
      };
    })
    .sort((a, b) => a.dataNext - b.dataNext)
    .filter((task) => task.dataJours <= 0);
}

// Appel de la fonction
fetchData().catch(console.error);
