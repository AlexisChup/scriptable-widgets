// Constants
const WIDGET_CONFIG = {
  padding: 22,
  maxItems: 6,
  url: "https://www.notion.so/alexis-chupin/Mes-syst-mes-17b6e735087c8064af97df08ca641d9d",
  storageKey: "widget-data.json",
};

// Main widget creation function
async function createWidget() {
  const { data, isFromStorage } = await loadData();
  const widget = buildWidget(data, isFromStorage);
  await saveData(data);
  return widget;
}

// Data management functions
async function loadData() {
  const apiData = await loadNotionData();
  if (apiData) {
    return {
      data: formatResponseFromApi(apiData),
      isFromStorage: false,
    };
  }

  const previousData = await loadPreviousData();
  if (previousData) {
    return {
      data: convertStoredDates(previousData),
      isFromStorage: true,
    };
  }

  return null;
}

function convertStoredDates(data) {
  return data.map((item) => ({
    ...item,
    dataNext: new Date(item.dataNext),
    dataPrevious: new Date(item.dataPrevious),
  }));
}

async function loadNotionData() {
  const notionToken = Keychain.get("notionTokenDbSys");
  const databaseId = Keychain.get("notionIdDBSys");
  const notionAPI = `https://api.notion.com/v1/databases/${databaseId}/query`;

  const req = new Request(notionAPI);
  req.method = "POST";
  req.headers = {
    Authorization: `Bearer ${notionToken}`,
    "Notion-Version": "2021-05-13",
    "Content-Type": "application/json",
  };

  try {
    return await req.loadJSON();
  } catch (error) {
    console.log("Erreur lors de la récupération des données : ", error);
    return null;
  }
}

async function loadPreviousData() {
  try {
    const fm = FileManager.local();
    const path = fm.joinPath(fm.documentsDirectory(), WIDGET_CONFIG.storageKey);

    if (fm.fileExists(path)) {
      const fileContent = fm.readString(path);
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.log("Error loading previous data:", error);
  }
  return null;
}

async function saveData(data) {
  try {
    const fm = FileManager.local();
    const path = fm.joinPath(fm.documentsDirectory(), WIDGET_CONFIG.storageKey);
    fm.writeString(path, JSON.stringify(data));
  } catch (error) {
    console.log("Error saving data:", error);
  }
}

// Widget building functions
function buildWidget(data, isFromStorage = false) {
  const widget = new ListWidget();
  setupWidgetLayout(widget);

  if (!data) {
    return buildErrorWidget();
  }

  addWidgetHeader(widget, isFromStorage);
  addWidgetContent(widget, data);
  addStatusFooter(widget, isFromStorage);

  return widget;
}

function setupWidgetLayout(widget) {
  widget.setPadding(
    WIDGET_CONFIG.padding,
    WIDGET_CONFIG.padding,
    WIDGET_CONFIG.padding,
    WIDGET_CONFIG.padding
  );
  widget.url = WIDGET_CONFIG.url;
}

function addWidgetHeader(widget, isFromStorage = false) {
  const header = widget.addText(
    `🚀 Actions à venir${isFromStorage ? " 📱" : " 🔄"}`
  );
  header.font = Font.blackSystemFont(20);
  widget.addSpacer(8);
}

function addWidgetContent(widget, data) {
  const itemsToShow = data.slice(0, WIDGET_CONFIG.maxItems);
  itemsToShow.forEach((item) => {
    addDataView(widget, item);
    widget.addSpacer(6);
  });
}

function addStatusFooter(widget, isFromStorage) {
  widget.addSpacer();

  const statusText = widget.addText(
    `${isFromStorage ? "📱" : "🔄"} • ${new Date().toLocaleTimeString()}`
  );
  statusText.font = Font.systemFont(10);
  statusText.textColor = Color.gray();
  statusText.rightAlignText();
}

function buildErrorWidget() {
  const widget = new ListWidget();
  setupWidgetLayout(widget);

  const header = widget.addText("⚠️ Erreur de connexion");
  header.font = Font.blackSystemFont(20);
  widget.addSpacer(8);

  const message = widget.addText("Impossible de charger les données");
  message.font = Font.mediumSystemFont(14);
  message.textColor = Color.red();

  return widget;
}

// Data formatting functions
function extractIconFromName(taskName, properties) {
  // Chercher dans les clés des propriétés une correspondance avec le nom de la tâche
  const matchingKey = Object.keys(properties).find((key) =>
    key.includes(taskName)
  );

  if (matchingKey) {
    // Extraire l'emoji du début de la clé si présent
    const emojiMatch = matchingKey.match(/^[\u{1F300}-\u{1F9FF}]/u);
    if (emojiMatch) return emojiMatch[0];
  }

  return "📝"; // Emoji par défaut
}

// Data formatting functions
function formatResponseFromApi(json) {
  return json.results
    .map((page) => ({
      dataName: page.properties["Système"].title[0].plain_text,
      dataIcon: extractIconFromName(
        page.properties["Système"].title[0].plain_text,
        page.properties
      ),
      dataUrl: page.properties["Système"].title[0].href,
      dataPrevious: new Date(page.properties["Previous"].formula.string),
      dataNext: new Date(page.properties["Next"].formula.date.start),
      dataCategorie: page.properties["Catégorie"].select.name,
      dataJours: page.properties["Jours"].formula.number,
      dataActions: page.properties["Actions"].formula.string,
      dataCommentaire: page.properties["Commentaire"].formula.string,
    }))
    .sort((a, b) => a.dataNext - b.dataNext);
}

function addDataView(widget, item) {
  const viewStack = widget.addStack();
  viewStack.layoutVertically();
  viewStack.url = item.dataUrl;

  const name = viewStack.addText(`${item.dataIcon} ${item.dataName}`);
  name.font = Font.blackSystemFont(14);

  const date = viewStack.addText(
    (item.dataNext instanceof Date
      ? item.dataNext
      : new Date(item.dataNext)
    ).toLocaleDateString()
  );
  date.font = Font.mediumSystemFont(10);
  date.textColor = Color.gray();

  if (item.dataJours <= 0) {
    styleTodayItem(name, date);
  } else {
    addRemainingDays(viewStack, item.dataJours);
  }
}

function styleTodayItem(name, date) {
  name.font = new Font("Avenir Next Heavy Italic", 14);
  name.textColor = new Color("#004dcf");

  date.text = "📆 Aujourd'hui";
  date.textColor = new Color("#004dcf");
  date.font = new Font("Avenir Next Heavy", 12);
}

function addRemainingDays(viewStack, jours) {
  const joursText = viewStack.addText(
    `${jours} jour${jours > 1 ? "s" : ""} restant${jours > 1 ? "s" : ""}`
  );

  if (jours > 10) {
    joursText.font = Font.mediumSystemFont(10);
    joursText.textColor = new Color("#A7C7E7");
  } else if (jours > 3) {
    joursText.font = Font.semiboldSystemFont(10);
    joursText.textColor = new Color("#5C89B3");
  } else if (jours > 0) {
    joursText.font = Font.boldSystemFont(10);
    joursText.textColor = new Color("#3371A1");
  }
}

// Main execution
const widget = await createWidget();
Script.setWidget(widget);
Script.complete();
widget.presentLarge();
