document.addEventListener("DOMContentLoaded", () => {
  // --- CONFIG & STATE ---
  const allGifts = [
    // image paths are used from the page context (index.html), so use paths relative to that file
    { id: "main1", name: "Bean Bag Chair", type: "main", image: "images/bean-bag.jpg" },
    { id: "side1", name: "Mystery Box", type: "side", image: "images/deco-box.png" },
    { id: "side2", name: "Hoodie", type: "side", image: "images/hoodie.jpg" },
    { id: "side3", name: "Customised Tumbler", type: "side", image: "images/tumbler.jpg" },
    { id: "side4", name: "Perfume", type: "side", image: "images/perfume.jpg" }
    // { id: "jackpot1", name: "Jackpot!", type: "jackpot", image: "images/jackpot.jpg" }
  ];

  const cards = document.querySelectorAll(".scratch-card");
  const mainTitle = document.getElementById("main-title");

  // Modals
  const confirmationModal = document.getElementById("confirmation-modal");
  const btnYes = document.getElementById("modal-btn-yes");
  const btnNo = document.getElementById("modal-btn-no");
  const gameOverModal = document.getElementById("game-over-modal");
  const closeGameOverBtn = document.getElementById("close-game-over-btn");

  // Game Over Controls
  const revealAllBtn = document.getElementById("reveal-all-btn");
  const downloadBtn = document.getElementById("download-btn");
  const shareBtn = document.getElementById("share-btn");
  const certificate = document.getElementById("winnings-certificate");

  const selectionsAllowed = 3;
  let cardToScratch = null;
  let gameHasEnded = false;
  let wonGiftTypes = [];

  // --- GAME LIFECYCLE ---
  function startGame() {
    const raw = localStorage.getItem("scratchGameState");
    let savedState = null;
    if (raw) {
      try {
        savedState = JSON.parse(raw);
      } catch (err) {
        // if parsing fails, ignore and create a new game
        savedState = null;
      }
    }

    // Validate saved state shape before restoring
    if (savedState && Array.isArray(savedState.gifts) && savedState.gifts.length === cards.length) {
      restoreGameState(savedState);
    } else {
      // anything invalid (null, malformed, wrong length) — start fresh
      initNewGame();
    }
  }

  function initNewGame() {
    const shuffledGifts = shuffle([...allGifts]);
    const cardStates = [];

    cards.forEach((card, index) => {
      const gift = shuffledGifts[index];
      const cardState = { ...gift, scratched: false, index };
      cardStates.push(cardState);
      applyCardState(card, cardState);
      card.addEventListener("click", handleCardSelection);
    });

    requestAnimationFrame(drawAllCanvases);
    localStorage.setItem("scratchGameState", JSON.stringify({ gifts: cardStates }));
  }

  function restoreGameState(savedState) {
    // Apply card state from saved state, and determine whether this is a completed game
    const gifts = savedState.gifts || [];
    const scratchedCount = gifts.filter(g => g && g.scratched).length;

    // reset local runtime tracking
    wonGiftTypes = [];

    gifts.forEach((cardState, index) => {
      if (cards[index]) {
        const card = cards[index];
        // only apply state when cardState is a valid object
        if (cardState && typeof cardState === 'object') {
          applyCardState(card, cardState);
        }

        // If user had scratched this card before, restore that flag
        if (cardState && cardState.scratched) {
          card.classList.add("is-scratched");
          wonGiftTypes.push(cardState.type);
        }

        // If this saved state was a completed session (all gifts revealed), mark fully-scratched
        // Otherwise, keep canvases intact so the user can continue scratching
        if (cardState && cardState.fullyScratched) {
          card.classList.add("fully-scratched");
        }
      }
    });

    // redraw overlays
    requestAnimationFrame(drawAllCanvases);

    // If the saved state indicates the user completed the allowed picks, restore final view
    if (scratchedCount >= selectionsAllowed) {
      // mark every card as revealed (fully-scratched) — this matches previous behavior
      cards.forEach(card => card.classList.add("fully-scratched"));
      gameHasEnded = true;
      document.body.classList.add("selection-done");
      populateCertificate();
      showGameOverModal(true);
      mainTitle.textContent = "Welcome Back!";
    } else {
      // Mid-game restore: allow user to keep playing
      gameHasEnded = false;
      mainTitle.textContent = `Pick ${selectionsAllowed - wonGiftTypes.length} more card(s)...`;
      // attach listeners to any cards that are not yet scratched
      cards.forEach(card => {
        if (!card.classList.contains("is-scratched")) {
          card.addEventListener("click", handleCardSelection);
        }
      });
    }
  }

  // --- INITIALIZATION & DRAWING HELPERS ---
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function applyCardState(card, cardState) {
    card.dataset.giftId = cardState.id;
    card.dataset.giftName = cardState.name;
    card.dataset.giftType = cardState.type;
    card.dataset.giftImage = cardState.image;
    if (cardState.index !== undefined) card.dataset.cardIndex = cardState.index;

    const prizeContent = card.querySelector(".prize-content");
    prizeContent.querySelector("img").src = cardState.image;
    prizeContent.querySelector("p").textContent = cardState.name;
  }

  function drawAllCanvases() {
      cards.forEach(card => {
        const prizeContent = card.querySelector('.prize-content');
        prizeContent.classList.remove("is-hidden");
        if (card.classList.contains('fully-scratched')) {
            const canvas = card.querySelector(".scratch-surface");
            if(canvas) canvas.style.opacity = 0;
        } else {
            const canvas = card.querySelector(".scratch-surface");
            if (canvas) {
              const ctx = canvas.getContext("2d");
              const width = card.clientWidth;
              const height = card.clientHeight;
              if (width > 0 && height > 0) {
                // support high DPI displays
                const ratio = window.devicePixelRatio || 1;
                // set internal pixel size to ratio-scaled size
                canvas.width = Math.max(1, Math.floor(width * ratio));
                canvas.height = Math.max(1, Math.floor(height * ratio));
                // keep CSS size equal to logical width/height so events use CSS pixels
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                // reset transform and scale context to device pixel ratio
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(ratio, ratio);
                drawScratchSurface(ctx, width, height);
              }
            }
        }
      });
  }

  function drawScratchSurface(ctx, width, height) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(Math.PI / 4);
    const diagonal = Math.sqrt(width * width + height * height);
    ctx.translate(-diagonal / 2, -diagonal / 2);
    const emojiSize = width / 9;
    const step = emojiSize * 2;
    ctx.font = `${emojiSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = step / 2; y < diagonal; y += step) {
      for (let x = step / 2; x < diagonal; x += step) {
        ctx.fillText("🎁", x, y);
      }
    }
    ctx.restore();
  }

  // --- EVENT HANDLING ---
  function handleCardSelection(e) {
    const selectedCard = e.currentTarget;
    if (selectedCard.classList.contains("is-scratched") || gameHasEnded) return;
    cardToScratch = selectedCard;
    confirmationModal.querySelector("#modal-text").textContent = `Are you sure you want to scratch this card? ${selectionsAllowed - wonGiftTypes.length} choice(s) remaining.`;
    confirmationModal.classList.add("visible");
  }

  btnYes.addEventListener("click", () => {
    if (!cardToScratch) return;
    confirmationModal.classList.remove("visible");

    // if (cardToScratch.dataset.giftType === 'jackpot') {
    //   const sideCard = findUnscratchedCardOfType('side');
    //   if (sideCard) swapCardData(cardToScratch, sideCard);
    // }
    
    const currentPickType = cardToScratch.dataset.giftType;
    const mainGiftsWon = wonGiftTypes.filter(t => t === 'main').length;

    if (mainGiftsWon === 1 && currentPickType === 'main') {
      let swapped = false;
      const sideCard = findUnscratchedCardOfType('side');
      if (sideCard) swapped = swapCardData(cardToScratch, sideCard);
      // fallback: swap with any other available unscratched card (should be rare)
      if (!swapped) {
        const fallback = [...cards].find(c => !c.classList.contains('is-scratched') && c !== cardToScratch);
        if (fallback) swapped = swapCardData(cardToScratch, fallback);
      }
      if (!swapped) console.warn('No available card to swap with (expected side).');
    }
    else if (wonGiftTypes.length === selectionsAllowed - 1 && mainGiftsWon === 0 && currentPickType !== 'main') {
      let swapped = false;
      const mainCard = findUnscratchedCardOfType('main');
      if (mainCard) swapped = swapCardData(cardToScratch, mainCard);
      if (!swapped) {
        const fallback = [...cards].find(c => !c.classList.contains('is-scratched') && c !== cardToScratch);
        if (fallback) swapped = swapCardData(cardToScratch, fallback);
      }
      if (!swapped) console.warn('No available card to swap with (expected main).');
    }
    
    wonGiftTypes.push(cardToScratch.dataset.giftType);
    cardToScratch.classList.add("is-scratched");
    // persist mid-game state immediately so reloads keep accurate dataset
    saveGameState();
    cardToScratch.removeEventListener("click", handleCardSelection);

    if (wonGiftTypes.length < selectionsAllowed) {
      mainTitle.textContent = `Pick ${selectionsAllowed - wonGiftTypes.length} more card(s)...`;
    }

    setupScratching(cardToScratch);
  });

  btnNo.addEventListener("click", () => {
    confirmationModal.classList.remove("visible");
    cardToScratch = null;
  });

  closeGameOverBtn.addEventListener("click", () => gameOverModal.classList.remove("visible"));
  gameOverModal.addEventListener("click", (e) => {
    if (e.target === gameOverModal) gameOverModal.classList.remove("visible");
  });

  revealAllBtn.addEventListener("click", () => {
    cards.forEach((card) => {
      if (!card.classList.contains("is-scratched")) {
        card.classList.add("fully-scratched");
      }
    });
    revealAllBtn.style.display = "none";
  });

  downloadBtn.addEventListener("click", () => {
    html2canvas(certificate, { backgroundColor: null, useCORS: true }).then((canvas) => {
      const link = document.createElement("a");
      link.download = "my-winnings.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  });

  shareBtn.addEventListener("click", async () => {
    if (navigator.share) {
      try {
        const canvas = await html2canvas(certificate, { backgroundColor: null, useCORS: true });
        canvas.toBlob(async (blob) => {
          const file = new File([blob], "my-winnings.png", { type: "image/png" });
          await navigator.share({
            title: "My Winnings!",
            text: "Check out the awesome gifts I won!",
            files: [file],
          });
        }, "image/png");
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      alert("Web Share API is not supported in your browser. Try downloading the image instead!");
    }
  });

  // --- CORE LOGIC & GAME STATE ---
  function findUnscratchedCardOfType(type) {
    return [...cards].find(c => !c.classList.contains("is-scratched") && c.dataset.giftType === type && c !== cardToScratch);
  }

  function swapCardData(cardA, cardB) {
    if (!cardA || !cardB) return false;
    const tempDataset = { ...cardA.dataset };
    Object.assign(cardA.dataset, cardB.dataset);
    Object.assign(cardB.dataset, tempDataset);
    
    applyCardState(cardA, cardA.dataset);
    applyCardState(cardB, cardB.dataset);

    const canvasA = cardA.querySelector('.scratch-surface');
    if (canvasA) {
      const ctxA = canvasA.getContext('2d');
      const ratioA = window.devicePixelRatio || 1;
      ctxA.setTransform(1, 0, 0, 1, 0, 0);
      ctxA.scale(ratioA, ratioA);
      drawScratchSurface(ctxA, cardA.clientWidth, cardA.clientHeight);
    }
    const canvasB = cardB.querySelector('.scratch-surface');
    if (canvasB) {
      const ctxB = canvasB.getContext('2d');
      const ratioB = window.devicePixelRatio || 1;
      ctxB.setTransform(1, 0, 0, 1, 0, 0);
      ctxB.scale(ratioB, ratioB);
      drawScratchSurface(ctxB, cardB.clientWidth, cardB.clientHeight);
    }

    // Persist the updated order / datasets so reloads will restore the swapped state
    saveGameState();
    return true;
  }

  function endGame() {
    if (gameHasEnded) return;
    gameHasEnded = true;

    document.body.classList.add("selection-done");
    mainTitle.textContent = "Here are your gifts!";
    saveFinalState();

    setTimeout(() => {
      populateCertificate();
      showGameOverModal();
    }, 5000);
  }

  function populateCertificate() {
    const wonGifts = [];
    cards.forEach((card) => {
      if (card.classList.contains("is-scratched")) {
        wonGifts.push({
          name: card.dataset.giftName,
          image: card.dataset.giftImage,
        });
      }
    });

    const container = certificate.querySelector(".won-gifts-container");
    container.innerHTML = "";
    wonGifts.forEach((gift) => {
      const giftEl = document.createElement("div");
      giftEl.classList.add("won-gift");
      giftEl.innerHTML = `<img src="${gift.image}" alt="${gift.name}"><p>${gift.name}</p>`;
      container.appendChild(giftEl);
    });
  }

  function showGameOverModal(isRestored = false) {
    gameOverModal.classList.add("visible");
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      zIndex: 1001,
    });

    if (isRestored) {
      revealAllBtn.style.display = "none";
    }
    if (!navigator.share) {
      shareBtn.style.display = "none";
    }
  }

  function saveFinalState() {
    const finalState = { gifts: [] };
    cards.forEach((card) => {
      const cardState = {
        id: card.dataset.giftId,
        name: card.dataset.giftName,
        type: card.dataset.giftType,
        image: card.dataset.giftImage,
        index: card.dataset.cardIndex,
        scratched: card.classList.contains("is-scratched"),
        fullyScratched: card.classList.contains("fully-scratched"),
      };
      finalState.gifts.push(cardState);
    });
    localStorage.setItem("scratchGameState", JSON.stringify(finalState));
  }

  // Save current in-progress game state (called on swap, scratch, or partial completion)
  function saveGameState() {
    const state = { gifts: [] };
    cards.forEach((card) => {
      state.gifts.push({
        id: card.dataset.giftId || null,
        name: card.dataset.giftName || null,
        type: card.dataset.giftType || null,
        image: card.dataset.giftImage || null,
        index: card.dataset.cardIndex || null,
        scratched: card.classList.contains('is-scratched'),
        fullyScratched: card.classList.contains('fully-scratched')
      });
    });
    try {
      localStorage.setItem('scratchGameState', JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to persist scratchGameState', err);
    }
  }

  function setupScratching(card) {
    const canvas = card.querySelector(".scratch-surface");
    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    // Prevent adding multiple listeners for the same canvas
    if (canvas.dataset.scratchingSetup === "true") return;
    canvas.dataset.scratchingSetup = "true";

    let isDrawing = false;

    // helper to get coordinates relative to canvas (CSS pixels)
    function getXY(e) {
      const rect = canvas.getBoundingClientRect();
      // Pointer events and mouse have offsetX/offsetY; touch needs conversion
      if (e instanceof TouchEvent) {
        const t = e.touches[0] || e.changedTouches[0];
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
      }
      // For PointerEvent / MouseEvent (offsetX/offsetY reliably available)
      return { x: e.offsetX !== undefined ? e.offsetX : e.clientX - rect.left, y: e.offsetY !== undefined ? e.offsetY : e.clientY - rect.top };
    }

    function scratch(x, y) {
      if (!isDrawing) return;
      // use a slightly larger radius for touch/finger, scale will be applied via context
      const radius = Math.max(16, (canvas.clientWidth || 200) / 25);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2, true);
      ctx.fill();
      checkScratchedArea(card, canvas, ctx);
    }

    // --- Pointer events (cover mouse, pen, touch on modern browsers) ---
    function onPointerDown(e) {
      isDrawing = true;
      // capture pointer so we continue to receive events while interacting
      try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch {};
      const { x, y } = getXY(e);
      scratch(x, y);
    }
    function onPointerMove(e) {
      if (!isDrawing) return;
      const { x, y } = getXY(e);
      scratch(x, y);
    }
    function onPointerUp(e) {
      isDrawing = false;
      try { e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch {};
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // --- Touch fallback for older browsers that don't support pointer events ---
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      isDrawing = true;
      const { x, y } = getXY(e);
      scratch(x, y);
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (!isDrawing) return;
      const { x, y } = getXY(e);
      scratch(x, y);
    }, { passive: false });
    canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      isDrawing = false;
    });
    canvas.addEventListener("touchcancel", (e) => { isDrawing = false; });
  }

  function checkScratchedArea(card, canvas, ctx) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparentPixels = 0;
    // count pixels where alpha is effectively transparent. Allow for slight anti-aliasing
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] <= 10) transparentPixels++;
    }
    if ((transparentPixels / (canvas.width * canvas.height)) * 100 > 50) {
      if (!card.classList.contains("fully-scratched")) {
        card.classList.add("fully-scratched");
        // persist change immediately
        saveGameState();

        const fullyScratchedCount = document.querySelectorAll(".is-scratched.fully-scratched").length;
        if (fullyScratchedCount === selectionsAllowed) {
          endGame();
        }
      }
    }
  }

  startGame();
});