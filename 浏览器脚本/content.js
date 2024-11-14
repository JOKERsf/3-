console.log("插件已启动");

let timeoutId = null;
let openedPdfWindow = null;
let currentPatentNumber = null;
let lastMouseX, lastMouseY;
const hoverDelay = 500; // 鼠标停止后的延迟时间（单位：毫秒）

// 移除已存在的图片预览
function removeImage() {
  const existingImg = document.getElementById("patent-image-preview");
  if (existingImg) existingImg.remove();
  currentPatentNumber = null;
}

// 显示专利图片
function showImage(patentNumber, event) {
  const imagePath = chrome.runtime.getURL(`images/${patentNumber}.png`);
  const img = document.createElement("img");
  img.src = imagePath;
  img.style.position = "fixed";
  img.style.top = `${event.clientY + window.scrollY + 10}px`;
  img.style.left = `${event.clientX + 10}px`;
  img.style.border = "2px solid #888";
  img.style.borderRadius = "8px";
  img.style.zIndex = "9999";
  img.id = "patent-image-preview";

  // 图片按原始尺寸显示
  img.onload = () => {
    img.style.width = `${img.naturalWidth}px`;
    img.style.height = `${img.naturalHeight}px`;
  };

  img.onerror = () => {
    console.error("图片加载失败:", imagePath);
    img.remove();
  };

  removeImage(); // 移除旧图片，防止重叠
  document.body.appendChild(img);
}

// 检测鼠标是否在专利号文本区域内（忽略周围的空格）
function checkForPatentNumber(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);

  if (target && target.nodeType === Node.ELEMENT_NODE) {
    // 获取该元素的文本内容，并去除两端的空白字符
    const text = target.textContent.trim();

    // 使用正则表达式匹配专利号（匹配 CN 开头，后跟 9-12 位数字和最后的字母）
    const patentNumbers = [...text.matchAll(/CN\d{9,12}[A-Z]/g)];

    // 遍历所有匹配到的专利号
    patentNumbers.forEach((match) => {
      const patentNumber = match[0];

      // 获取包含专利号的文本节点（遍历所有子节点）
      let textNode = null;
      for (let child of target.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && child.textContent.includes(patentNumber)) {
          textNode = child;
          break;
        }
      }

      if (!textNode) {
        console.error("专利号未找到对应的文本节点:", patentNumber);
        return;
      }

      // 获取专利号的实际开始位置（相对于文本节点）
      const startOffset = match.index;
      const endOffset = startOffset + patentNumber.length;

      // 如果 startOffset 超出文本节点长度，跳过
      if (startOffset >= textNode.length) {
        console.error("Invalid range for patent number:", patentNumber);
        return;
      }

      // 调试输出
      console.log(`Patent Number: ${patentNumber}, Start: ${startOffset}, End: ${endOffset}`);

      // 创建 Range 对象来获取专利号的区域
      const range = document.createRange();

      // 设置 Range 的开始和结束偏移量
      try {
        range.setStart(textNode, startOffset);
        range.setEnd(textNode, endOffset);
      } catch (e) {
        console.error("Range error:", e);
        return;
      }

      // 获取专利号的矩形区域
      const rect = range.getBoundingClientRect();

      // 检查鼠标是否在专利号文本的精确区域内
      const isInTextArea =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      range.detach(); // 清理 Range 对象

      // 如果鼠标位置在专利号区域内，则显示图片并绑定双击事件
      if (isInTextArea) {
        showImage(patentNumber, event);
        currentPatentNumber = patentNumber;

        // 双击事件打开对应 PDF
        target.ondblclick = (e) => {
          e.stopPropagation(); // 阻止事件冒泡
          const pdfPath = chrome.runtime.getURL(`pdfs/${patentNumber}.pdf`);
          if (openedPdfWindow && !openedPdfWindow.closed) {
            openedPdfWindow.close();
          }
          openedPdfWindow = window.open(pdfPath, '_blank');
        };

        // 鼠标离开时移除图片
        target.addEventListener(
          "mouseleave",
          () => {
            removeImage();
          },
          { once: true }
        );
      }
    });
  }
}

// 监听鼠标移动事件
document.addEventListener("mousemove", (event) => {
  if (timeoutId) clearTimeout(timeoutId);

  // 如果鼠标位置未改变，则认为鼠标停止移动
  if (event.clientX === lastMouseX && event.clientY === lastMouseY) {
    return;
  }

  // 记录当前鼠标位置
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;

  // 设置延迟 0.5 秒后检查鼠标位置
  timeoutId = setTimeout(() => {
    checkForPatentNumber(event);
  }, hoverDelay);
});
