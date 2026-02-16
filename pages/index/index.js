Page({
  onLoad() {
    const target = '/pages/model/model';
    wx.redirectTo({
      url: target,
      fail: () => {
        wx.reLaunch({ url: target });
      }
    });
  }
});
