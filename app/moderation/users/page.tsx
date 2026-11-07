import PageTitle from "@/components/staff/PageTitle";
import MutePanel from "@/components/staff/MutePanel";

export default function ModerationUsersPage() {
  return (
    <>
      <PageTitle
        title="Пользователи"
        hint="Mute: пользователь может пользоваться сайтом, но не публикует объявления."
      />
      <MutePanel />
    </>
  );
}
