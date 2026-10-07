// version: 7.12.0.a.1.6.8
// sha: ddccb77fc2604ba2f04c02df28af901641816708
function SetBookmark(){var o=window.parent,t=window.location.href;o.SetBookmark(t.substring(t.toLowerCase().lastIndexOf("/scormcontent/")+14,t.length),document.title),o.CommitData()}SetBookmark();