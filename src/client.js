document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("[data-markdown]");
  if (!root) return;

  const blockElements = [
    "P",
    "DIV",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "BLOCKQUOTE",
    "PRE",
    "UL",
    "OL",
    "LI",
  ];
  const markdownMap = { STRONG: "**", EM: "*", CODE: "`", S: "~~" };

  root.querySelectorAll("*").forEach((el) => {
    if (blockElements.includes(el.tagName)) {
      el.contentEditable = "true";
    }
  });

  const isInsideCode = (el) => {
    while (el) {
      if (el.tagName === "CODE") return true;
      el = el.parentElement;
    }
    return false;
  };

  const isInsideListItem = (el) => {
    while (el) {
      if (el.tagName === "LI") return el;
      el = el.parentElement;
    }
    return null;
  };

  root.addEventListener("keydown", (e) => {
    const sel = window.getSelection();
    if (!sel?.isCollapsed) return;
    const node = sel.anchorNode;
    if (!node) return;
    const parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const liEl = isInsideListItem(parent);

    // exit list on Enter in empty last <li>
    if (e.key === "Enter" && liEl && !isInsideCode(parent)) {
      const isEmpty = liEl.innerText.trim() === "";
      const parentList = liEl.parentElement;
      const isLastItem = liEl === parentList?.lastElementChild;

      if (isEmpty && isLastItem) {
        e.preventDefault();

        parentList.removeChild(liEl);
        if (parentList.children.length === 0) parentList.remove();

        const newP = document.createElement("P");
        newP.contentEditable = "true";
        newP.style.outline = "1px dashed #ccc";
        newP.innerHTML = "<br>";
        parentList?.parentElement?.insertBefore(newP, parentList.nextSibling);

        const range = document.createRange();
        range.setStart(newP, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
    }

    // enter inside code block
    if (e.key === "Enter" && isInsideCode(parent)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const offset = sel.anchorOffset;
      const text = node.textContent ?? "";
      node.textContent = text.slice(0, offset) + "\n" + text.slice(offset);

      const range = document.createRange();
      range.setStart(node, offset + 1);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }

    // heading decrease with backspace
    if (e.key === "Backspace" && /^H[1-6]$/.test(parent?.tagName)) {
      const offset = sel.anchorOffset;
      if (offset === 0) {
        e.preventDefault();
        const level = Number(parent.tagName[1]);
        const newTag = level > 1 ? `H${level - 1}` : "P";

        const newEl = document.createElement(newTag);
        newEl.contentEditable = "true";
        newEl.style.outline = "1px dashed #ccc";
        newEl.innerHTML = parent.innerHTML;

        parent.replaceWith(newEl);

        const range = document.createRange();
        range.setStart(newEl.firstChild || newEl, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
    }

    // list backspace at start to unwrap
    if (e.key === "Backspace" && liEl) {
      const isTopLevel = !liEl.closest("ul ul, ol ol, ul ol, ol ul");

      const range = sel.getRangeAt(0);
      const isAtStart =
        (range.startOffset === 0 && range.startContainer === liEl) ||
        (range.startContainer.nodeType === Node.TEXT_NODE &&
          range.startOffset === 0 &&
          liEl.contains(range.startContainer));

      if (isTopLevel && isAtStart) {
        e.preventDefault();

        const parentList = liEl.parentElement;
        const newP = document.createElement("P");
        newP.contentEditable = "true";
        newP.style.outline = "1px dashed #ccc";
        newP.innerHTML = liEl.innerHTML || "<br>";

        parentList.removeChild(liEl);
        if (parentList.children.length === 0) parentList.remove();

        parentList.parentElement.insertBefore(newP, parentList.nextSibling);

        const newRange = document.createRange();
        newRange.setStart(newP, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        return;
      }
    }

    // tab in list
    if (e.key === "Tab" && liEl && !isInsideCode(parent)) {
      e.preventDefault();
      e.stopImmediatePropagation();

      const listType = liEl.parentElement?.tagName;

      if (e.shiftKey) {
        const currentList = liEl.parentElement;
        const grandparentLi = currentList?.closest("li");
        if (currentList && grandparentLi) {
          currentList.removeChild(liEl);
          grandparentLi.parentElement.insertBefore(
            liEl,
            grandparentLi.nextSibling,
          );
          if (!currentList.querySelector("li")) currentList.remove();
        }
      } else {
        const prevLi = liEl.previousElementSibling;
        if (!prevLi) return;

        let nestedList = Array.from(prevLi.children).find(
          (c) => c.tagName === "UL" || c.tagName === "OL",
        );
        if (!nestedList) {
          nestedList = document.createElement(listType ?? "UL");
          nestedList.style.paddingLeft = "1.5em";
          prevLi.appendChild(nestedList);
        }
        nestedList.appendChild(liEl);
      }

      return;
    }

    // tab inside code block
    if (e.key === "Tab" && isInsideCode(parent)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const offset = sel.anchorOffset;
      const text = node.textContent ?? "";

      if (e.shiftKey && text.slice(offset - 2, offset) === "  ") {
        node.textContent = text.slice(0, offset - 2) + text.slice(offset);
        const range = document.createRange();
        range.setStart(node, offset - 2);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        node.textContent = text.slice(0, offset) + "  " + text.slice(offset);
        const range = document.createRange();
        range.setStart(node, offset + 2);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      return;
    }

    // backspace: inline unwrapping or heading markdown injection
    if (e.key === "Backspace") {
      const delim = markdownMap[parent?.tagName];
      if (delim) {
        e.preventDefault();
        const raw = node.textContent ?? "";
        const textNode = document.createTextNode(delim + raw + delim);
        parent.replaceWith(textNode);

        const range = document.createRange();
        range.setStart(textNode, delim.length + (sel.anchorOffset ?? 0));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }

      if (/^H[1-6]$/.test(parent?.tagName) && sel.anchorOffset === 0) {
        e.preventDefault();
        const level = Number(parent.tagName[1]);
        const raw = node.textContent ?? "";
        const textNode = document.createTextNode("#".repeat(level) + " " + raw);
        parent.replaceWith(textNode);

        const range = document.createRange();
        range.setStart(textNode, level + 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
    }
  });

  root.addEventListener("input", (e) => {
    if (e.inputType !== "insertText") return;
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    if (!sel?.isCollapsed || !node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    const text = node.textContent ?? "";

    const match = text.match(/^(#{1,6}) (.*)/);
    if (match && parent && blockElements.includes(parent.tagName)) {
      const level = match[1].length;
      const content = match[2];

      const newTag = `H${level}`;
      const newEl = document.createElement(newTag);
      newEl.contentEditable = "true";
      newEl.style.outline = "1px dashed #ccc";
      newEl.textContent = content;

      parent.replaceWith(newEl);

      const range = document.createRange();
      range.setStart(newEl.firstChild || newEl, content.length);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    const delimiter = markdownMap[parent?.tagName];
    if (!delimiter) return;
    if (sel.anchorOffset === text.length) {
      const lastChar = text.slice(-1);
      node.textContent = text.slice(0, -1);
      const newNode = document.createTextNode(lastChar);
      parent.after(newNode);
      const range = document.createRange();
      range.setStart(newNode, 1);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });

  // save on blur
  let saveTimeout;
  const save = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      fetch("/__save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: location.pathname,
          html: root.innerHTML,
        }),
      }).then((res) => {
        res.ok ? console.log("✅ Saved") : console.error("❌ Save failed");
      });
    }, 300);
  };

  root.addEventListener("blur", save, true);
});
