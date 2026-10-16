class GuildQueue {
  constructor() {
    this.tracks = [];
  }

  add(track) {
    this.tracks.push(track);
    return this.length;
  }

  unshift(track) {
    this.tracks.unshift(track);
    return this.length;
  }

  shift() {
    return this.tracks.shift();
  }

  peek() {
    return this.tracks[0];
  }

  removeAt(index) {
    if (index < 0 || index >= this.tracks.length) return null;
    const [removed] = this.tracks.splice(index, 1);
    return removed;
  }

  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
    return this.tracks;
  }

  clear() {
    this.tracks = [];
  }

  getAll() {
    return [...this.tracks];
  }

  get length() {
    return this.tracks.length;
  }
}

module.exports = GuildQueue;
