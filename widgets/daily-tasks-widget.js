// Constants
const WIDGET_CONFIG = {
  padding: 22,
  url: "https://www.notion.so/alexis-chupin/Mes-syst-mes-17b6e735087c8064af97df08ca641d9d",
  notificationDelay: 3, // seconds
  storageKey: "daily-tasks-widget-data.json",
};

const STORAGE_KEYS = {
  lastUpdate: "lastDateUpdatedTasks",
};

// Main widget creation function
async function createWidget() {
  const data = await loadData();
  const isFromStorage = !(await loadNotionData());
  if (!data) {
    return buildErrorWidget();
  }

  const widget = new ListWidget();
  setupWidgetLayout(widget);

  const nextTask = data[0];
  if (nextTask.dataJours > 0) {
    createChillWidget(widget, nextTask);
  } else {
    const todayTasks = getTasksToday(data);
    createTasksWidget(widget, todayTasks);
    handleNotifications(todayTasks, data);
  }

  addStatusFooter(widget, isFromStorage);

  // Save data if it's fresh from API
  if (!isFromStorage) {
    await saveData(data);
  }

  return widget;
}

// Data management functions
async function loadData() {
  const apiData = await loadNotionData();
  if (apiData) {
    return formatResponseFromApi(apiData);
  }

  const previousData = await loadPreviousData();
  if (previousData) {
    return convertStoredDates(previousData);
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

// Widget building functions
function setupWidgetLayout(widget) {
  widget.setPadding(
    WIDGET_CONFIG.padding,
    WIDGET_CONFIG.padding,
    WIDGET_CONFIG.padding,
    WIDGET_CONFIG.padding
  );
  widget.url = WIDGET_CONFIG.url;
}

function createChillWidget(widget, nextTask) {
  const header = widget.addText("CHILL");
  header.font = new Font("Avenir Next Heavy Italic", 30);
  header.textColor = new Color("8f00ff");
  header.centerAlignText();

  const countdownText = widget.addText(`J-${nextTask.dataJours}`);
  countdownText.font = new Font("Avenir Next Heavy", 12);
  countdownText.textColor = new Color("bb63ff");
  countdownText.centerAlignText();

  widget.addSpacer(8);

  const dateText = widget.addText(nextTask.dataNext.toLocaleDateString());
  dateText.font = Font.italicSystemFont(10);
  dateText.textColor = new Color("d9a8ff");
  dateText.centerAlignText();
  dateText.textOpacity = 0.3;
}

function createTasksWidget(widget, todayTasks) {
  const nbTasksToday = todayTasks.length;

  const header = widget.addText(
    `${nbTasksToday} TASK${nbTasksToday > 1 ? "S" : ""}`
  );
  header.font = new Font("Avenir Next Heavy Italic", 22);
  header.textColor = new Color("004dcf");
  header.centerAlignText();

  const clocheAlert = widget.addText(`🔔`);
  clocheAlert.font = new Font("Avenir Next Heavy", 16);
  clocheAlert.centerAlignText();

  widget.addSpacer(6);

  todayTasks.forEach((item) => {
    const taskText = widget.addText(item.dataNameWithEmoji);
    taskText.font = Font.mediumSystemFont(10);
    taskText.textColor = new Color("4377cf");
    taskText.centerAlignText();
    taskText.lineLimit = 1;
  });
}

function buildErrorWidget() {
  const widget = new ListWidget();
  setupWidgetLayout(widget);

  const header = widget.addText("⚠️ Erreur de connexion");
  header.font = Font.blackSystemFont(20);
  header.centerAlignText();
  widget.addSpacer(8);

  const message = widget.addText("Impossible de charger les données");
  message.font = Font.mediumSystemFont(14);
  message.textColor = Color.red();
  message.centerAlignText();

  return widget;
}

// Data formatting functions
function formatResponseFromApi(json) {
  return json.results
    .map((page) => ({
      dataId: page.properties["Système"].title[0].mention.page.id,
      dataName: page.properties["Système"].title[0].plain_text,
      dataUrl: page.properties["Système"].title[0].href,
      dataPrevious: new Date(page.properties["Previous"].formula.string),
      dataNext: new Date(page.properties["Next"].formula.date.start),
      dataCategorie: page.properties["Catégorie"].select.name,
      dataJours: page.properties["Jours"].formula.number,
      dataActions: page.properties["Actions"].formula.string,
      dataCommentaire: page.properties["Commentaire"].formula.string,
      dataNameWithEmoji: `${
        page.properties["Catégorie"].select.name.split(" ")[0]
      } ${page.properties["Système"].title[0].plain_text}`,
    }))
    .sort((a, b) => a.dataNext - b.dataNext);
}

function getTasksToday(tasks) {
  return tasks.filter((task) => task.dataJours <= 0);
}

// Notification handling functions
function handleNotifications(todayTasks, allTasks) {
  const dateNow = new Date();
  const triggerDate = new Date(
    dateNow.getTime() + 1000 * WIDGET_CONFIG.notificationDelay
  );

  let tasksToNotify = todayTasks;
  let tasksToSet = allTasks;

  if (Keychain.contains(STORAGE_KEYS.lastUpdate)) {
    const lastDatesUpdated = JSON.parse(Keychain.get(STORAGE_KEYS.lastUpdate));
    if (lastDatesUpdated) {
      setLastDatesUpdated(lastDatesUpdated, tasksToSet);
      tasksToNotify = getFilterTasksNotifications(todayTasks, lastDatesUpdated);
    }
  }

  if (tasksToNotify?.length > 0) {
    const dateFormatted = dateNow.toLocaleDateString();
    tasksToNotify.forEach((task) => {
      createNotification(task, triggerDate);
      updateLastDatesUpdated(task, tasksToSet, dateFormatted);
    });
  }

  const simplifiedTasks = simplifyTasksToStore(tasksToSet);
  Keychain.set(STORAGE_KEYS.lastUpdate, JSON.stringify(simplifiedTasks));
}

function createNotification(task, triggerDate) {
  const notification = new Notification();
  notification.title = "🔔 Nouvelle quête !";
  notification.body = task.dataNameWithEmoji;
  notification.setTriggerDate(triggerDate);
  notification.sound = "complete";
  notification.schedule();
}

function getFilterTasksNotifications(todayTasks, storageLastDatesUpdated) {
  const dateToday = new Date().toLocaleDateString();
  return todayTasks
    .filter((task) => {
      const inStorage = storageLastDatesUpdated.find(
        (storageItem) => storageItem.dataId === task.dataId
      );
      return inStorage ? inStorage.lastDateNotification !== dateToday : true;
    })
    .map((task) => ({ ...task, lastDateNotification: dateToday }));
}

function setLastDatesUpdated(lastDatesUpdatedInStorage, tasksToSetToStore) {
  lastDatesUpdatedInStorage.forEach((lastTask) => {
    const taskToSetItem = tasksToSetToStore.find(
      (taskToSetMap) => taskToSetMap.dataId === lastTask.dataId
    );
    if (taskToSetItem) {
      taskToSetItem.lastDateNotification = lastTask.lastDateNotification;
    }
  });
}

function updateLastDatesUpdated(taskToNotifyMap, tasksToSet, dateFormatted) {
  const taskToSetItem = tasksToSet.find(
    (taskToSetMap) => taskToSetMap.dataId === taskToNotifyMap.dataId
  );
  taskToSetItem.lastDateNotification = dateFormatted;
}

function simplifyTasksToStore(tasksToSet) {
  return tasksToSet.map((item) => ({
    dataId: item.dataId,
    dataName: item.dataName,
    lastDateNotification: item.lastDateNotification ?? "",
  }));
}

function addStatusFooter(widget, isFromStorage) {
  widget.addSpacer();

  const statusText = widget.addText(
    `${isFromStorage ? "📱" : "🔄"} • ${new Date().toLocaleTimeString()}`
  );
  statusText.font = Font.systemFont(10);
  statusText.textColor = Color.gray();
  statusText.centerAlignText();
}

// Main execution
const widget = await createWidget();
Script.setWidget(widget);
Script.complete();
widget.presentSmall();
