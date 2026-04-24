import {
  HomeOutline,
  FolderOpenOutline,
  DocumentTextOutline,
  CreateOutline,
  DownloadOutline,
  TimeOutline,
  BarChartOutline,
  RadioOutline,
  SettingsOutline,
  InformationCircleOutline,
  PeopleOutline,
  LocationOutline,
  ListOutline,
  FilmOutline,
  GitBranchOutline,
  ArrowBackOutline
} from '@vicons/ionicons5'
import type { Component } from 'vue'

/**
 * 统一图标映射表，全部使用 @vicons/ionicons5
 * 用于侧边栏导航、面包屑等需要图标的场景
 */
export const NAV_ICONS: Record<string, Component> = {
  // 全局导航
  dashboard: HomeOutline,
  projects: FolderOpenOutline,
  scripts: DocumentTextOutline,
  studio: CreateOutline,
  import: DownloadOutline,
  jobs: TimeOutline,
  stats: BarChartOutline,
  modelCalls: RadioOutline,
  settings: SettingsOutline,

  // 项目内导航
  overview: InformationCircleOutline,
  characters: PeopleOutline,
  locations: LocationOutline,
  episodes: ListOutline,
  compose: FilmOutline,
  pipeline: GitBranchOutline,

  // 通用
  back: ArrowBackOutline
}

export default NAV_ICONS
