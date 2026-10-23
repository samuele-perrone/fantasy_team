import SwiftUI

struct LoginView: View {
    @Environment(AuthStore.self) private var auth
    @State private var busy = false

    var body: some View {
        VStack(spacing: 28) {
            Spacer()
            VStack(spacing: 14) {
                LogoMark(size: 84)
                (Text("Fantasy").foregroundStyle(Theme.text)
                    + Text("Team").foregroundStyle(Theme.brand)
                    + Text("Hub").foregroundStyle(Theme.text))
                    .font(.system(size: 28, weight: .bold))
                Text("Keep, watch or sell for every player in your FPL squad, and live Premier League scores with your players picked out.")
                    .font(.callout)
                    .foregroundStyle(Theme.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 12)
            }
            Spacer()
            VStack(spacing: 12) {
                Button {
                    busy = true
                    Task {
                        await auth.signInWithGoogle()
                        busy = false
                    }
                } label: {
                    HStack(spacing: 8) {
                        Text("G").font(.system(size: 18, weight: .bold)).foregroundStyle(Color(hex: 0x4285F4))
                        Text(busy ? "Opening Google…" : "Sign in with Google").font(.system(size: 17, weight: .semibold))
                    }
                    .foregroundStyle(Color(hex: 0x1F1F1F))
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: 0xD7DCE8)))
                }
                .disabled(busy)

                if let error = auth.error {
                    Text(error).font(.footnote).foregroundStyle(Theme.sell).multilineTextAlignment(.center)
                }
                Text("FantasyTeamHub is invite-only for now. Sign in with the Google account you were invited with.")
                    .font(.caption)
                    .foregroundStyle(Theme.faint)
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background.ignoresSafeArea())
    }
}
