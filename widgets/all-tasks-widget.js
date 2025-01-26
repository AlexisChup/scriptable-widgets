let apiResponse = await loadNotionData();

if (apiResponse !== null) {
  const formattedResponse = formatResponseFromApi(apiResponse);
  console.log("formattedResponse: \n");
  console.log(JSON.stringify(formattedResponse, null, 4));

  let widget = new ListWidget();
  let padding = 22;
  widget.setPadding(padding, padding, padding, padding);
  widget.url =
    "https://www.notion.so/alexis-chupin/Mes-syst-mes-17b6e735087c8064af97df08ca641d9d";

  let header = widget.addText("🚀 Actions à venir");
  header.font = Font.blackSystemFont(20);
  widget.addSpacer(8);

  const NB_ELEMENTS_A_MONTRER = 6;
  const sysToShow = formattedResponse.slice(0, NB_ELEMENTS_A_MONTRER);

  sysToShow.forEach((item) => {
    addDataView(widget, item);
    widget.addSpacer(6);
  });

  Script.setWidget(widget);
  Script.complete();
  widget.presentLarge();
} else {
  console.log("Erreur dans l'appel de l'API de notion.");
}

async function loadNotionData() {
  // constuc the request
  const notionToken = Keychain.get("notionTokenDbSys");
  const databaseId = Keychain.get("notionIdDBSys");
  const notionAPI =
    "https://api.notion.com/v1/databases/" + databaseId + "/query";

  let req = new Request(notionAPI);

  req.method = "POST";
  req.headers = {
    Authorization: `Bearer ${notionToken}`,
    "Notion-Version": "2021-05-13",
    "Content-Type": "application/json",
  };

  try {
    console.log("loadNotionData request at: \n" + notionAPI);
    let json = await req.loadJSON();

    return json;
  } catch (error) {
    console.log("Erreur lors de la récupération des données : ", error);

    return null;
  }
}

function formatResponseFromApi(json) {
  const formattedResponse = json.results
    .map((page, _) => {
      const dataName = page.properties["Système"].title[0].plain_text;
      const dataUrl = page.properties["Système"].title[0].href;

      const dataPrevious = new Date(page.properties["Previous"].formula.string);
      const dataNext = new Date(page.properties["Next"].formula.date.start);

      const dataCategorie = page.properties["Catégorie"].select.name;
      const dataJours = page.properties["Jours"].formula.number;

      const dataActions = page.properties["Actions"].formula.string;
      const dataCommentaire = page.properties["Commentaire"].formula.string;

      return {
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
    .sort((a, b) => a.dataNext - b.dataNext);

  return formattedResponse;
}

function addDataView(widget, item) {
  let viewStack = widget.addStack();
  viewStack.layoutVertically();
  viewStack.url = item.dataUrl;

  let name = viewStack.addText(
    `${item.dataCategorie.split(" ")[0]} ${item.dataName}`
  );
  name.font = Font.blackSystemFont(14);

  let date = viewStack.addText(item.dataNext.toLocaleDateString());
  date.font = Font.mediumSystemFont(10);
  date.textColor = Color.gray();

  if (item.dataJours <= 0) {
    name.font = new Font("Avenir Next Heavy Italic", 14);
    name.textColor = new Color("#004dcf");

    date.text = "📆 Aujourd'hui";
    date.textColor = new Color("#004dcf");
    date.font = new Font("Avenir Next Heavy", 12);
  } else {
    let jours = viewStack.addText(
      `${item.dataJours} jour${item.dataJours > 1 ? "s" : ""} restant${
        item.dataJours > 1 ? "s" : ""
      }`
    );

    if (item.dataJours > 10) {
      jours.font = Font.mediumSystemFont(10);
      jours.textColor = new Color("#A7C7E7");
    } else if (item.dataJours > 3) {
      jours.font = Font.semiboldSystemFont(10);
      jours.textColor = new Color("#5C89B3");
    } else if (item.dataJours > 0) {
      jours.font = Font.boldSystemFont(10);
      jours.textColor = new Color("#3371A1");
    }
  }
}
