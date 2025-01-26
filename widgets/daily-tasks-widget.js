// ***************  GET DATA      *************** //
const KEY_LAST_UPDATE = "lastDateUpdatedTasks";
let apiResponse = await loadNotionData();

if (apiResponse !== null) {
  const formattedResponse = formatResponseFromApi(apiResponse);
  const nextTasks = formattedResponse[0];

  // ***************  CREATE WIDGET *************** //
  let widget = new ListWidget();
  const PADDING = 22;
  widget.setPadding(PADDING, PADDING, PADDING, PADDING);

  if (nextTasks.dataJours !== 0) {
    createChillWidget(widget, nextTasks);
  } else {
    const tasksTodays = getTasksToday(formattedResponse);
    createTasksWidget(widget, tasksTodays);
    handleNotifications(tasksTodays, formattedResponse);
  }

  Script.setWidget(widget);
  Script.complete();
  widget.presentSmall();
} else {
  console.log("Erreur dans l'appel de l'API de notion.");
}

// ***************  FUNCTIONS    *************** //

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

  // execute the request
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

      const dataNameWithEmoji = `${dataCategorie.split(" ")[0]} ${dataName}`;

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
        dataNameWithEmoji,
      };
    })
    .sort((a, b) => a.dataNext - b.dataNext);
}

function isSameDay(dataNext, dataNow) {
  return (
    dataNow.getFullYear() === dataNext.getFullYear() &&
    dataNow.getMonth() === dataNext.getMonth() &&
    dataNow.getDate() === dataNext.getDate()
  );
}

function getTasksToday(formattedResponse) {
  const dateNow = new Date();

  return formattedResponse.filter((item) => isSameDay(dateNow, item.dataNext));
}

function createChillWidget(widget, nextTasks) {
  let header = widget.addText("CHILL");
  header.font = new Font("Avenir Next Heavy Italic", 30);
  header.textColor = new Color("8f00ff");
  header.centerAlignText();

  let countdownText = widget.addText(`J-${nextTasks.dataJours}`);
  countdownText.font = new Font("Avenir Next Heavy", 12);
  countdownText.textColor = new Color("bb63ff");
  countdownText.centerAlignText();

  widget.addSpacer(8);

  let dateText = widget.addText(nextTasks.dataNext.toLocaleDateString());
  dateText.font = Font.italicSystemFont(10);
  dateText.textColor = new Color("d9a8ff");
  dateText.centerAlignText();
  dateText.textOpacity = 0.3;
}

function createTasksWidget(widget, tasksTodays) {
  const nbTasksToday = tasksTodays.length;

  let header = widget.addText(
    `${nbTasksToday} TASK${nbTasksToday > 1 ? "S" : ""}`
  );
  header.font = new Font("Avenir Next Heavy Italic", 22);
  header.textColor = new Color("004dcf");
  header.centerAlignText();

  let clocheAlert = widget.addText(`🔔`);
  clocheAlert.font = new Font("Avenir Next Heavy", 16);
  // clocheAlert.textColor = new Color("bb63ff");
  clocheAlert.centerAlignText();

  widget.addSpacer(6);

  tasksTodays.forEach((item) => {
    let dateText = widget.addText(item.dataNameWithEmoji);
    dateText.font = Font.mediumSystemFont(10); // Texte plus petit que le titre
    dateText.textColor = new Color("4377cf");
    dateText.centerAlignText();
    dateText.lineLimit = 1;
  });
}

function handleNotifications(tasksTodays, allTasks) {
  const dateNow = new Date();
  const triggerSeconds = 3;
  const triggerDate = new Date(dateNow.getTime() + 1000 * triggerSeconds);

  let tasksToNotify = tasksTodays;
  let tasksToSet = allTasks;

  if (Keychain.contains(KEY_LAST_UPDATE)) {
    const lastDatesUpdated = JSON.parse(Keychain.get(KEY_LAST_UPDATE));

    if (lastDatesUpdated !== null) {
      setLastDatesUpdated(lastDatesUpdated, tasksToSet);

      tasksToNotify = getFilterTasksNotifications(
        tasksTodays,
        lastDatesUpdated
      );
    }
  }

  if (tasksToNotify && tasksToNotify !== null && tasksToNotify.length > 0) {
    const dateFormatted = dateNow.toLocaleDateString();

    tasksToNotify.forEach((taskToNotifyMap) => {
      createNotification(taskToNotifyMap, triggerDate);
      updateLastDatesUpdated(taskToNotifyMap, tasksToSet, dateFormatted);
    });
  }

  tasksToSet = simplifyTasksToStore(tasksToSet);

  Keychain.set(KEY_LAST_UPDATE, JSON.stringify(tasksToSet));
}

function createNotification(task, triggerDate) {
  let notification = new Notification();
  notification.title = "🔔 Nouvelle quête !";
  notification.body = task.dataNameWithEmoji;

  notification.setTriggerDate(triggerDate);
  notification.sound = "complete";
  notification.schedule();
}

function getFilterTasksNotifications(tasksTodays, storageLastDatesUpdated) {
  const dateToday = new Date().toLocaleDateString();

  return tasksTodays
    .filter((task) => {
      const inStorage = storageLastDatesUpdated.find(
        (storageItem) => storageItem.dataId === task.dataId
      );

      if (inStorage) {
        return inStorage.lastDateNotification !== dateToday;
      } else {
        return true;
      }
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
