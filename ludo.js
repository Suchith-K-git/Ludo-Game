let selected = null;

document.querySelectorAll(".cell").forEach(cell => {
  cell.addEventListener("click", () => {

    // Select a colored token
    if (
      cell.classList.contains("red") ||
      cell.classList.contains("blue") ||
      cell.classList.contains("green") ||
      cell.classList.contains("yellow")
    ) {
      selected = cell;
    }
    // Move token to empty cell
    else if (selected) {
      cell.className = selected.className;
      selected.className = "cell";
      selected = null;
    }

  });
});
