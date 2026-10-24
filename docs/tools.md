# Tool reference: generated tools

The server registers 247 tools. The README lists the hand-written ones. This page lists the rest: one tool per resource type in Apple's App Store Connect OpenAPI spec, built at startup from `src/spec/asc-spec.ts`.

Every generated tool takes an `action`. The actions a tool offers are the ones Apple's API has for that resource. `create`, `update` and `delete` are writes: they need `confirm: true` and a non-empty `reason`. With a read-only token on the web API, only `list` and `get` are allowed.

This table has 165 tools. Regenerate it after updating the spec snapshot.

| Tool | Resource | Actions |
|---|---|---|
| `asc_actors` | `actors` | list, get |
| `asc_age_rating_declarations` | `ageRatingDeclarations` | list, update |
| `asc_alternative_distribution_domains` | `alternativeDistributionDomains` | list, get, create, delete |
| `asc_alternative_distribution_keys` | `alternativeDistributionKeys` | list, get, create, delete |
| `asc_alternative_distribution_package_deltas` | `alternativeDistributionPackageDeltas` | list, get |
| `asc_alternative_distribution_packages` | `alternativeDistributionPackages` | list, get, create |
| `asc_alternative_distribution_package_variants` | `alternativeDistributionPackageVariants` | list, get |
| `asc_alternative_distribution_package_versions` | `alternativeDistributionPackageVersions` | list, get |
| `asc_analytics_report_instances` | `analyticsReportInstances` | list, get |
| `asc_analytics_report_requests` | `analyticsReportRequests` | list, get, create, delete |
| `asc_analytics_reports` | `analyticsReports` | list, get |
| `asc_analytics_report_segments` | `analyticsReportSegments` | list, get |
| `asc_android_to_ios_app_mapping_details` | `androidToIosAppMappingDetails` | list, get, create, update, delete |
| `asc_app_availabilities` | `appAvailabilities` | list, get, create |
| `asc_app_categories` | `appCategories` | list, get |
| `asc_app_clip_advanced_experience_images` | `appClipAdvancedExperienceImages` | get, create, update |
| `asc_app_clip_advanced_experiences` | `appClipAdvancedExperiences` | list, get, create, update |
| `asc_app_clip_app_store_review_details` | `appClipAppStoreReviewDetails` | list, get, create, update |
| `asc_app_clip_default_experience_localizations` | `appClipDefaultExperienceLocalizations` | list, get, create, update, delete |
| `asc_app_clip_default_experiences` | `appClipDefaultExperiences` | list, get, create, update, delete |
| `asc_app_clip_header_images` | `appClipHeaderImages` | list, get, create, update, delete |
| `asc_app_clips` | `appClips` | list, get |
| `asc_app_encryption_declaration_documents` | `appEncryptionDeclarationDocuments` | list, get, create, update |
| `asc_app_encryption_declarations` | `appEncryptionDeclarations` | list, get, create |
| `asc_app_info_localizations` | `appInfoLocalizations` | list, get, create, update, delete |
| `asc_app_infos` | `appInfos` | list, get, update |
| `asc_app_price_points` | `appPricePoints` | list, get |
| `asc_app_price_schedules` | `appPriceSchedules` | list, get, create |
| `asc_apps` | `apps` | list, get, update |
| `asc_app_store_review_attachments` | `appStoreReviewAttachments` | list, get, create, update, delete |
| `asc_app_store_review_details` | `appStoreReviewDetails` | list, get, create, update |
| `asc_app_store_version_localizations` | `appStoreVersionLocalizations` | list, get, create, update, delete |
| `asc_app_store_version_phased_releases` | `appStoreVersionPhasedReleases` | list, create, update, delete |
| `asc_app_store_version_promotions` | `appStoreVersionPromotions` | create |
| `asc_app_store_version_release_requests` | `appStoreVersionReleaseRequests` | create |
| `asc_app_store_versions` | `appStoreVersions` | list, get, create, update, delete |
| `asc_app_store_version_submissions` | `appStoreVersionSubmissions` | list, delete |
| `asc_app_tags` | `appTags` | list, update |
| `asc_background_assets` | `backgroundAssets` | list, get, create, update |
| `asc_background_asset_upload_files` | `backgroundAssetUploadFiles` | list, get, create, update |
| `asc_background_asset_version_app_store_releases` | `backgroundAssetVersionAppStoreReleases` | get |
| `asc_background_asset_version_external_beta_releases` | `backgroundAssetVersionExternalBetaReleases` | get |
| `asc_background_asset_version_internal_beta_releases` | `backgroundAssetVersionInternalBetaReleases` | get |
| `asc_background_asset_versions` | `backgroundAssetVersions` | list, get, create |
| `asc_beta_app_clip_invocation_localizations` | `betaAppClipInvocationLocalizations` | create, update, delete |
| `asc_beta_app_clip_invocations` | `betaAppClipInvocations` | list, get, create, update, delete |
| `asc_beta_app_localizations` | `betaAppLocalizations` | list, get, create, update, delete |
| `asc_beta_app_review_details` | `betaAppReviewDetails` | list, get, update |
| `asc_beta_app_review_submissions` | `betaAppReviewSubmissions` | list, get, create |
| `asc_beta_build_localizations` | `betaBuildLocalizations` | list, get, create, update, delete |
| `asc_beta_crash_logs` | `betaCrashLogs` | list, get |
| `asc_beta_feedback_crash_submissions` | `betaFeedbackCrashSubmissions` | list, get, delete |
| `asc_beta_feedback_screenshot_submissions` | `betaFeedbackScreenshotSubmissions` | list, get, delete |
| `asc_beta_groups` | `betaGroups` | list, get, create, update, delete |
| `asc_beta_license_agreements` | `betaLicenseAgreements` | list, get, update |
| `asc_beta_recruitment_criteria` | `betaRecruitmentCriteria` | list, create, update, delete |
| `asc_beta_recruitment_criterion_options` | `betaRecruitmentCriterionOptions` | list |
| `asc_beta_tester_invitations` | `betaTesterInvitations` | create |
| `asc_beta_testers` | `betaTesters` | list, get, create, delete |
| `asc_build_beta_details` | `buildBetaDetails` | list, get, update |
| `asc_build_beta_notifications` | `buildBetaNotifications` | create |
| `asc_builds` | `builds` | list, get, update |
| `asc_build_upload_files` | `buildUploadFiles` | list, get, create, update |
| `asc_build_uploads` | `buildUploads` | list, get, create, delete |
| `asc_bundle_id_capabilities` | `bundleIdCapabilities` | list, create, update, delete |
| `asc_bundle_ids` | `bundleIds` | list, get, create, update, delete |
| `asc_certificates` | `certificates` | list, get, create, update, delete |
| `asc_ci_artifacts` | `ciArtifacts` | list, get |
| `asc_ci_build_actions` | `ciBuildActions` | list, get |
| `asc_ci_build_runs` | `ciBuildRuns` | list, get, create |
| `asc_ci_issues` | `ciIssues` | list, get |
| `asc_ci_mac_os_versions` | `ciMacOsVersions` | list, get |
| `asc_ci_products` | `ciProducts` | list, get, delete |
| `asc_ci_test_results` | `ciTestResults` | list, get |
| `asc_ci_workflows` | `ciWorkflows` | list, get, create, update, delete |
| `asc_ci_xcode_versions` | `ciXcodeVersions` | list, get |
| `asc_devices` | `devices` | list, get, create, update |
| `asc_end_app_availability_pre_orders` | `endAppAvailabilityPreOrders` | create |
| `asc_end_user_license_agreements` | `endUserLicenseAgreements` | list, get, create, update, delete |
| `asc_game_center_achievement_images` | `gameCenterAchievementImages` | list, get, create, update, delete |
| `asc_game_center_achievement_localizations` | `gameCenterAchievementLocalizations` | list, get, create, update, delete |
| `asc_game_center_achievement_releases` | `gameCenterAchievementReleases` | list, get, create, delete |
| `asc_game_center_achievements` | `gameCenterAchievements` | list, get, create, update, delete |
| `asc_game_center_achievement_versions` | `gameCenterAchievementVersions` | list, get, create |
| `asc_game_center_activities` | `gameCenterActivities` | list, get, create, update, delete |
| `asc_game_center_activity_images` | `gameCenterActivityImages` | list, get, create, update, delete |
| `asc_game_center_activity_localizations` | `gameCenterActivityLocalizations` | list, get, create, update, delete |
| `asc_game_center_activity_version_releases` | `gameCenterActivityVersionReleases` | list, get, create, delete |
| `asc_game_center_activity_versions` | `gameCenterActivityVersions` | list, get, create, update |
| `asc_game_center_app_versions` | `gameCenterAppVersions` | list, get, create, update |
| `asc_game_center_challenge_images` | `gameCenterChallengeImages` | list, get, create, update, delete |
| `asc_game_center_challenge_localizations` | `gameCenterChallengeLocalizations` | list, get, create, update, delete |
| `asc_game_center_challenges` | `gameCenterChallenges` | list, get, create, update, delete |
| `asc_game_center_challenge_version_releases` | `gameCenterChallengeVersionReleases` | list, get, create, delete |
| `asc_game_center_challenge_versions` | `gameCenterChallengeVersions` | list, get, create |
| `asc_game_center_detail_players` | `gameCenterDetailPlayers` | list, update |
| `asc_game_center_details` | `gameCenterDetails` | list, get, create, update |
| `asc_game_center_groups` | `gameCenterGroups` | list, get, create, update, delete |
| `asc_game_center_leaderboard_entry_submissions` | `gameCenterLeaderboardEntrySubmissions` | create |
| `asc_game_center_leaderboard_images` | `gameCenterLeaderboardImages` | list, get, create, update, delete |
| `asc_game_center_leaderboard_localizations` | `gameCenterLeaderboardLocalizations` | list, get, create, update, delete |
| `asc_game_center_leaderboard_releases` | `gameCenterLeaderboardReleases` | list, get, create, delete |
| `asc_game_center_leaderboards` | `gameCenterLeaderboards` | list, get, create, update, delete |
| `asc_game_center_leaderboard_set_images` | `gameCenterLeaderboardSetImages` | list, get, create, update, delete |
| `asc_game_center_leaderboard_set_localizations` | `gameCenterLeaderboardSetLocalizations` | list, get, create, update, delete |
| `asc_game_center_leaderboard_set_member_localizations` | `gameCenterLeaderboardSetMemberLocalizations` | list, create, update, delete |
| `asc_game_center_leaderboard_set_releases` | `gameCenterLeaderboardSetReleases` | list, get, create, delete |
| `asc_game_center_leaderboard_sets` | `gameCenterLeaderboardSets` | list, get, create, update, delete |
| `asc_game_center_leaderboard_set_versions` | `gameCenterLeaderboardSetVersions` | list, get, create |
| `asc_game_center_leaderboard_versions` | `gameCenterLeaderboardVersions` | list, get, create |
| `asc_game_center_matchmaking_queues` | `gameCenterMatchmakingQueues` | list, get, create, update, delete |
| `asc_game_center_matchmaking_rules` | `gameCenterMatchmakingRules` | list, create, update, delete |
| `asc_game_center_matchmaking_rule_sets` | `gameCenterMatchmakingRuleSets` | list, get, create, update, delete |
| `asc_game_center_matchmaking_rule_set_tests` | `gameCenterMatchmakingRuleSetTests` | create |
| `asc_game_center_matchmaking_teams` | `gameCenterMatchmakingTeams` | list, create, update, delete |
| `asc_game_center_player_achievement_submissions` | `gameCenterPlayerAchievementSubmissions` | create |
| `asc_game_center_score_moderations` | `gameCenterScoreModerations` | list, update |
| `asc_in_app_purchase_app_store_review_screenshots` | `inAppPurchaseAppStoreReviewScreenshots` | list, get, create, update, delete |
| `asc_in_app_purchase_availabilities` | `inAppPurchaseAvailabilities` | list, get, create |
| `asc_in_app_purchase_contents` | `inAppPurchaseContents` | list, get |
| `asc_in_app_purchase_images` | `inAppPurchaseImages` | list, get, create, update, delete |
| `asc_in_app_purchase_localizations` | `inAppPurchaseLocalizations` | list, get, create, update, delete |
| `asc_in_app_purchase_price_schedules` | `inAppPurchasePriceSchedules` | list, get, create |
| `asc_in_app_purchases` | `inAppPurchases` | list, get, create, update, delete |
| `asc_in_app_purchase_submissions` | `inAppPurchaseSubmissions` | create |
| `asc_in_app_purchase_versions` | `inAppPurchaseVersions` | list, get, create |
| `asc_marketplace_search_details` | `marketplaceSearchDetails` | list, create, update, delete |
| `asc_marketplace_webhooks` | `marketplaceWebhooks` | list, create, update, delete |
| `asc_merchant_ids` | `merchantIds` | list, get, create, update, delete |
| `asc_pass_type_ids` | `passTypeIds` | list, get, create, update, delete |
| `asc_pre_release_versions` | `preReleaseVersions` | list, get |
| `asc_profiles` | `profiles` | list, get, create, delete |
| `asc_review_submission_items` | `reviewSubmissionItems` | list, create, update, delete |
| `asc_review_submissions` | `reviewSubmissions` | list, get, create, update |
| `asc_routing_app_coverages` | `routingAppCoverages` | list, get, create, update, delete |
| `asc_sandbox_testers` | `sandboxTesters` | list, update |
| `asc_sandbox_testers_clear_purchase_history_request` | `sandboxTestersClearPurchaseHistoryRequest` | create |
| `asc_scm_git_references` | `scmGitReferences` | list, get |
| `asc_scm_providers` | `scmProviders` | list, get |
| `asc_scm_pull_requests` | `scmPullRequests` | list, get |
| `asc_scm_repositories` | `scmRepositories` | list, get |
| `asc_subscription_app_store_review_screenshots` | `subscriptionAppStoreReviewScreenshots` | list, get, create, update, delete |
| `asc_subscription_availabilities` | `subscriptionAvailabilities` | list, get, create |
| `asc_subscription_grace_periods` | `subscriptionGracePeriods` | list, get, update |
| `asc_subscription_group_localizations` | `subscriptionGroupLocalizations` | list, get, create, update, delete |
| `asc_subscription_groups` | `subscriptionGroups` | list, get, create, update, delete |
| `asc_subscription_group_submissions` | `subscriptionGroupSubmissions` | create |
| `asc_subscription_group_versions` | `subscriptionGroupVersions` | list, get, create |
| `asc_subscription_images` | `subscriptionImages` | list, get, create, update, delete |
| `asc_subscription_introductory_offers` | `subscriptionIntroductoryOffers` | list, create, update, delete |
| `asc_subscription_localizations` | `subscriptionLocalizations` | list, get, create, update, delete |
| `asc_subscription_plan_availabilities` | `subscriptionPlanAvailabilities` | list, get, create, update |
| `asc_subscription_price_points` | `subscriptionPricePoints` | list, get |
| `asc_subscription_prices` | `subscriptionPrices` | list, create, delete |
| `asc_subscription_promotional_offers` | `subscriptionPromotionalOffers` | list, get, create, update, delete |
| `asc_subscriptions` | `subscriptions` | list, get, create, update, delete |
| `asc_subscription_submissions` | `subscriptionSubmissions` | create |
| `asc_subscription_versions` | `subscriptionVersions` | list, get, create |
| `asc_territories` | `territories` | list |
| `asc_territory_availabilities` | `territoryAvailabilities` | list, update |
| `asc_user_invitations` | `userInvitations` | list, get, create, delete |
| `asc_users` | `users` | list, get, update, delete |
| `asc_webhook_deliveries` | `webhookDeliveries` | list, create |
| `asc_webhook_pings` | `webhookPings` | create |
| `asc_webhooks` | `webhooks` | list, get, create, update, delete |
