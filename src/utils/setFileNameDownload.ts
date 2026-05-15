function setFileNameDownload(prefix?:string) {
  const now = new Date();
  const preName = prefix ? prefix + "-" : "";

    const addName = `${preName}${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
      now.getHours(),
    ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
      now.getSeconds(),
        ).padStart(2, "0")}`;
    
    return addName
}

export {setFileNameDownload}