(async () => {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/linuxfandudeguy/durotube/refs/heads/main/index.html"
    );

    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

    const html = await res.text();

    // Replace current page content
    document.open();
    document.write(html);
    document.close();
  } catch (err) {
    console.error("Failed to load remote HTML:", err);
  }
})();
