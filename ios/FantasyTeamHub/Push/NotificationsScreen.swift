import SwiftUI

/// Live match notifications: on or off, which matches, and which events.
struct NotificationsScreen: View {
    @Environment(PushStore.self) private var push
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        @Bindable var push = push
        NavigationStack {
            Form {
                Section {
                    Toggle("Live match notifications", isOn: Binding(
                        get: { push.enabled && push.permission != .denied },
                        set: { on in
                            if on { Task { await push.turnOn() } } else { push.enabled = false }
                        }
                    ))
                    .tint(Theme.brandFill)
                } footer: {
                    if push.permission == .denied {
                        Text("Notifications are turned off for FantasyTeamHub in Settings.")
                    } else {
                        Text("Goals, red cards and full-time scores as they happen.")
                    }
                }
                if push.permission == .denied {
                    Button("Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    }
                }
                if push.enabled && push.permission != .denied {
                    Section {
                        Picker("Matches", selection: $push.scope) {
                            Text("Matches with my players").tag(PushStore.Scope.mine)
                            Text("All matches").tag(PushStore.Scope.all)
                        }
                        .pickerStyle(.inline)
                        .labelsHidden()
                    } header: {
                        Text("Matches")
                    } footer: {
                        Text("“My players” means a player from your FPL squad plays for either club. It uses the team on My Squad.")
                    }
                    Section("Events") {
                        Toggle("Goals", isOn: $push.goals)
                        Toggle("Red cards", isOn: $push.redCards)
                        Toggle("Full time", isOn: $push.fullTime)
                    }
                    .tint(Theme.brandFill)
                }
                if let error = push.error {
                    Text(error).font(.footnote).foregroundStyle(Theme.sell)
                }
            }
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Done") { dismiss() } }
            .task { await push.refreshPermission() }
        }
    }
}
