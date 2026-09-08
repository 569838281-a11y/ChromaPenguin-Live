import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Save, X } from "lucide-react";
import ImageCropModal from "./ImageCropModal.jsx";
import {
  AVATAR_SIZE,
  COVER_SIZE,
  cropImageToBlob,
  loadImageFromFile,
  needsCrop,
} from "../utils/profileImage.js";

export default function ProfileEditModal({
  open,
  user,
  busy = false,
  onClose,
  onSave,
}) {
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [avatarBlob, setAvatarBlob] = useState(null);
  const [coverBlob, setCoverBlob] = useState(null);
  const [crop, setCrop] = useState(null); // { image, target, kind }
  const [localBusy, setLocalBusy] = useState(false);

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    if (!open || !user) return;
    setNickname(user.nickname || "");
    setBio(user.bio || "");
    setAvatarPreview(user.avatar || "");
    setCoverPreview(user.cover || "");
    setAvatarBlob(null);
    setCoverBlob(null);
    setCrop(null);
  }, [open, user]);

  if (!open || !user) return null;

  const applyProcessedImage = (kind, blob) => {
    const url = URL.createObjectURL(blob);
    if (kind === "avatar") {
      setAvatarBlob(blob);
      setAvatarPreview(url);
    } else {
      setCoverBlob(blob);
      setCoverPreview(url);
    }
  };

  const handleFile = async (kind, file) => {
    if (!file) return;
    setLocalBusy(true);
    try {
      const img = await loadImageFromFile(file);
      const target = kind === "avatar" ? AVATAR_SIZE : COVER_SIZE;
      if (!needsCrop(img, target)) {
        const blob = await cropImageToBlob(
          img,
          { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight },
          target,
        );
        applyProcessedImage(kind, blob);
      } else {
        // Keep HTMLImageElement with object URL for crop preview
        const url = URL.createObjectURL(file);
        const previewImg = new Image();
        await new Promise((res, rej) => {
          previewImg.onload = res;
          previewImg.onerror = rej;
          previewImg.src = url;
        });
        setCrop({ image: previewImg, target, kind, revokeUrl: url });
      }
    } catch (err) {
      window.alert(err?.message || "读取图片失败");
    } finally {
      setLocalBusy(false);
    }
  };

  const handleCropConfirm = async (blob) => {
    if (!crop) return;
    applyProcessedImage(crop.kind, blob);
    if (crop.revokeUrl) URL.revokeObjectURL(crop.revokeUrl);
    setCrop(null);
  };

  const handleCropCancel = () => {
    if (crop?.revokeUrl) URL.revokeObjectURL(crop.revokeUrl);
    setCrop(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nick = nickname.trim();
    if (!nick) {
      window.alert("账号名称不能为空");
      return;
    }
    await onSave?.({
      nickname: nick,
      bio: bio.trim(),
      avatarBlob,
      coverBlob,
    });
  };

  const saving = busy || localBusy;

  return (
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fadeIn">
        <button
          type="button"
          className="absolute inset-0 bg-sky-900/35 backdrop-blur-sm"
          onClick={() => !saving && onClose?.()}
        />
        <form
          onSubmit={handleSubmit}
          className="glass-card relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white/95 p-5 shadow-soft sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-sky-800">编辑主页资料</h3>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl bg-white/80 p-2 text-sky-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Cover + avatar */}
          <div className="relative mb-10">
            <div className="overflow-hidden rounded-2xl">
              <div
                className="h-28 bg-cover bg-center sm:h-32"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(125,211,252,0.2), rgba(249,168,212,0.3)), url(${coverPreview})`,
                }}
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => coverInputRef.current?.click()}
              className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-xl bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-sky-800 shadow"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              更换背景
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                handleFile("cover", f);
              }}
            />

            <div className="absolute -bottom-8 left-4 z-20">
              <div className="relative">
                <img
                  src={avatarPreview}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover shadow-cloud ring-4 ring-white"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 z-30 flex h-8 w-8 items-center justify-center rounded-xl bg-sky-400 text-white shadow-md ring-2 ring-white transition hover:bg-sky-500"
                  title="更换头像"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    handleFile("avatar", f);
                  }}
                />
              </div>
            </div>
          </div>

          <p className="mb-3 text-[10px] text-sky-500">
            头像建议 {AVATAR_SIZE.width}×{AVATAR_SIZE.height}，背景建议 {COVER_SIZE.width}×
            {COVER_SIZE.height}；尺寸不符时会打开裁剪。
          </p>

          <label className="mb-3 block text-sm font-medium text-sky-800">
            账号名称
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={saving}
              maxLength={32}
              className="mt-1 w-full rounded-2xl bg-white/80 px-3 py-2.5 outline-none ring-1 ring-sky-100 focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
            />
          </label>

          <label className="mb-4 block text-sm font-medium text-sky-800">
            个性签名
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={saving}
              rows={3}
              maxLength={160}
              className="mt-1 w-full rounded-2xl bg-white/80 px-3 py-2.5 outline-none ring-1 ring-sky-100 focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-sky-400 to-pink-300 py-3 text-sm font-bold text-white shadow-cloud disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "保存中…" : "保存资料"}
          </button>
        </form>
      </div>

      {crop ? (
        <ImageCropModal
          open
          image={crop.image}
          target={crop.target}
          title={crop.kind === "avatar" ? "裁剪头像" : "裁剪背景图"}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </>
  );
}
