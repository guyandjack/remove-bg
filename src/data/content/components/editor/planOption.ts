//option des differents plans sur 24h
const planOption24 = {
  free: {
    image_size: 1,
    resolution: 5,
    credit: 2,
    change_color_bg: "5",
    change_img_bg: "local",
    toolEditor: ["resize", "finetune"],
  },
  hobby: {
    image_size: 4,
    resolution: 8,
    credit: 8,
    change_color_bg: "15",
    change_img_bg: "pexels",
    toolEditor: ["resize", "finetune", "ajust"],
  },
  pro: {
    image_size: 10,
    resolution: 10,
    credit: 20,
    change_color_bg: "full",
    change_img_bg: "pexels",
    toolEditor: ["resize", "finetune", "ajust", "annotate","filter","watermark"],
  },
};

export {planOption24}