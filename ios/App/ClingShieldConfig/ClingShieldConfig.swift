import ManagedSettings
import ManagedSettingsUI
import UIKit

/// ShieldConfiguration extension (bundle app.clingnote.ios.shieldconfig): ClingNote-branded shield.
class ClingShieldConfig: ShieldConfigurationDataSource {
    private func shield() -> ShieldConfiguration {
        let label = (LockShared.defaults?.dictionary(forKey: LockShared.stateKey)?["label"] as? String) ?? ""
        return ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: UIColor(red: 0.07, green: 0.09, blue: 0.15, alpha: 1),
            icon: UIImage(named: "AppIcon"),
            title: ShieldConfiguration.Label(text: "Locked in — ClingNote", color: .white),
            subtitle: ShieldConfiguration.Label(text: label.isEmpty ? "Finish your tasks to unlock." : "Locked in on \(label).", color: .lightGray),
            primaryButtonLabel: ShieldConfiguration.Label(text: "Back to work", color: .white),
            primaryButtonBackgroundColor: UIColor(red: 0.12, green: 0.36, blue: 1, alpha: 1))
    }
    override func configuration(shielding application: Application) -> ShieldConfiguration { shield() }
    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration { shield() }
    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration { shield() }
    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration { shield() }
}
